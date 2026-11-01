import {
    baseDatos,
    DIAS_SEMANA_CORTOS,
    SERVICIOS_DEFECTO,
    crearConfiguracionDefecto,
    normalizarConfiguracion,
    convertirHoraAMinutos,
    MinutosAHora,
    formatearDuracion,
    formatearFechaAClave,
    convertirClaveAObjetoDate,
    obtenerEtiquetaFecha,
    calcularCeldasOcupadas,
    escaparHTML
} from "./firebase.js";

import {
    collection,
    doc,
    onSnapshot,
    query,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Estado ---------- */

let configuration = crearConfiguracionDefecto();
let services = SERVICIOS_DEFECTO.map((s) => ({ ...s }));

const estado = {
    nombre: "",
    telefono: "",
    service: 0,
    fecha: null,
    hora: null,
    nota: "",
    celdasOcupadas: new Set(),
    guardando: false,
    reservaHecha: null
};

/* ---------- Elementos ---------- */

const el = (id) => document.getElementById(id);

const titulo = el("salon-name");
const paso1 = el("step-1");
const paso2 = el("step-2");
const pasoFin = el("step-done");

const inputNombre = el("client-name");
const inputTelefono = el("client-phone");
const selectServicio = el("client-svc");
const botonPaso2 = el("btn-to-step-2");

const resumenPaso = el("step-summary");
const contenedorDias = el("days-container");
const contenedorHoras = el("times-container");
const inputNota = el("client-note");
const textoError = el("booking-err");
const botonConfirmar = el("btn-confirm-booking");
const botonVolverPaso1 = el("btn-back-step-1");

const detallesFin = el("done-details");
const botonWhatsApp = el("btn-wa-notify");
const botonOtraCita = el("btn-book-again");

const enlaceEstado = el("btn-status");


/* ---------- Lógica de disponibilidad ---------- */

function horarioDelDia(clave) {
    return configuration.schedule[convertirClaveAObjetoDate(clave).getDay()];
}

// Próximos días abiertos (hasta configuration.days días)
function fechasDisponibles() {
    const resultado = [];
    const hoy = new Date();
    for (let i = 0; resultado.length < configuration.days && i < 90; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
        if (!configuration.schedule[d.getDay()].c) resultado.push(d);
    }
    return resultado;
}

function huecoLibre(clave, inicio, duracion) {
    const horario = horarioDelDia(clave);
    if (horario.c) return false;
    if (inicio < convertirHoraAMinutos(horario.o)) return false;
    if (inicio + duracion > convertirHoraAMinutos(horario.x)) return false;

    // Hoy: no se puede reservar una hora que ya ha pasado
    const ahora = new Date();
    if (clave === formatearFechaAClave(ahora)) {
        if (inicio <= ahora.getHours() * 60 + ahora.getMinutes()) return false;
    }

    return !calcularCeldasOcupadas(inicio, inicio + duracion)
        .some((i) => estado.celdasOcupadas.has(clave + "_" + i));
}

function horasLibres(clave) {
    const duracion = services[estado.service].time;
    const horario = horarioDelDia(clave);
    const horas = [];
    if (horario.c) return horas;
    for (let m = convertirHoraAMinutos(horario.o); m < convertirHoraAMinutos(horario.x); m += configuration.step) {
        if (huecoLibre(clave, m, duracion)) horas.push(m);
    }
    return horas;
}

/* ---------- Pintado ---------- */

function mostrarPaso(numero) {
    paso1.style.display = numero === 1 ? "" : "none";
    paso2.style.display = numero === 2 ? "" : "none";
    pasoFin.style.display = numero === 3 ? "" : "none";
}

function pintarCabecera() {
    titulo.textContent = configuration.salon;
    document.title = "Reserva tu cita · " + configuration.salon;
}

function pintarServicios() {
    if (estado.service >= services.length) estado.service = 0;
    selectServicio.innerHTML = services.map((s, i) =>
        `<option value="${i}" ${i === estado.service ? "selected" : ""}>${escaparHTML(s.n)} · ${formatearDuracion(s.time)}</option>`
    ).join("");
}

function datosPaso1Validos() {
    return estado.nombre.trim().length > 1 && estado.telefono.replace(/\D/g, "").length >= 9;
}

function pintarPaso2() {
    const service = services[estado.service];
    resumenPaso.textContent = `${estado.nombre} · ${service.n} (${service.time} min)`;

    const dias = fechasDisponibles();
    if (!dias.length) {
        contenedorDias.innerHTML = "";
        contenedorHoras.innerHTML = `<p class="mut">No hay días disponibles ahora mismo.</p>`;
        botonConfirmar.disabled = true;
        return;
    }
    if (!estado.fecha || !dias.some((d) => formatearFechaAClave(d) === estado.fecha)) {
        estado.fecha = formatearFechaAClave(dias[0]);
        estado.hora = null;
    }

    contenedorDias.innerHTML = dias.map((d) => {
        const clave = formatearFechaAClave(d);
        return `<button class="d ${clave === estado.fecha ? "on" : ""}" data-fecha="${clave}">${DIAS_SEMANA_CORTOS[d.getDay()]}<b>${d.getDate()}</b></button>`;
    }).join("");

    const horas = horasLibres(estado.fecha);
    if (estado.hora !== null && !horas.includes(estado.hora)) estado.hora = null;

    contenedorHoras.innerHTML = horas.length
        ? horas.map((m) => `<button class="t ${m === estado.hora ? "on" : ""}" data-hora="${m}">${MinutosAHora(m)}</button>`).join("")
        : `<p class="mut">No quedan huecos este día para este servicio. Prueba otro día.</p>`;

    textoError.textContent = estado.mensajeError || "";
    botonConfirmar.disabled = estado.hora === null || estado.guardando;
    botonConfirmar.textContent = estado.guardando ? "Guardando…" : "Enviar solicitud";
}

function pintarFin() {
    const r = estado.reservaHecha;
    const enlace = new URL("estado.html?id=" + r.id, window.location.href).href;
    detallesFin.innerHTML = `<b>${escaparHTML(r.service)}</b><br>${obtenerEtiquetaFecha(r.date)} a las ${MinutosAHora(r.start)} (${r.dur} min)`;
    const mensaje = encodeURIComponent(
        `Hola, soy ${r.name}. He pedido cita para ${r.service} el ${obtenerEtiquetaFecha(r.date)} a las ${MinutosAHora(r.start)}. ¿Me la confirmas? Aquí puedes ver el estado: ${enlace}`
    );
    botonWhatsApp.href = `https://wa.me/${configuration.wa}?text=${mensaje}`;
    enlaceEstado.href = enlace;
    mostrarPaso(3);
}

/* ---------- Reservar ---------- */

async function reservar() {
    const service = services[estado.service];
    const inicio = estado.hora;
    const fecha = estado.fecha;
    const celdas = calcularCeldasOcupadas(inicio, inicio + service.time);
    const idsCeldas = celdas.map((i) => fecha + "_" + i);

    const refReserva = doc(collection(baseDatos, "bookings"));
    const registro = {
        name: estado.nombre.trim(),
        phone: estado.telefono.trim(),
        service: service.n,
        dur: service.time,
        date: fecha,
        start: inicio,
        end: inicio + service.time,
        note: estado.nota.trim(),
        cells: idsCeldas,
        status: "pending",
        created: Date.now()
    };

    estado.guardando = true;
    estado.mensajeError = "";
    pintarPaso2();

    try {
        // Todo o nada: si alguna celda ya existe, "set" cuenta como update (prohibido) y falla el lote entero.
        const lote = writeBatch(baseDatos);
        idsCeldas.forEach((id, j) => lote.set(doc(baseDatos, "cells", id), { date: fecha, i: celdas[j] }));
        lote.set(refReserva, registro);
        await lote.commit();

        estado.reservaHecha = { ...registro, id: refReserva.id };  
        estado.guardando = false;
        pintarFin();
        return;
    } catch (error) {
        console.error("Error al reservar:", error);
        estado.mensajeError = error.code === "permission-denied"
            ? "Ese hueco acaba de ser reservado por otra persona. Elige otra hora."
            : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
        estado.hora = null;
    }
    estado.guardando = false;
    pintarPaso2();
}

/* ---------- Eventos ---------- */

inputNombre.addEventListener("input", () => {
    estado.nombre = inputNombre.value;
    botonPaso2.disabled = !datosPaso1Validos();
});

inputTelefono.addEventListener("input", () => {
    estado.telefono = inputTelefono.value;
    botonPaso2.disabled = !datosPaso1Validos();
});

selectServicio.addEventListener("change", () => {
    estado.service = +selectServicio.value;
    estado.hora = null;
});

inputNota.addEventListener("input", () => {
    estado.nota = inputNota.value;
});

botonPaso2.addEventListener("click", () => {
    estado.fecha = null;
    estado.hora = null;
    estado.mensajeError = "";
    mostrarPaso(2);
    pintarPaso2();
});

botonVolverPaso1.addEventListener("click", () => mostrarPaso(1));

contenedorDias.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-fecha]");
    if (!boton) return;
    estado.fecha = boton.dataset.fecha;
    estado.hora = null;
    estado.mensajeError = "";
    pintarPaso2();
});

contenedorHoras.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-hora]");
    if (!boton) return;
    estado.hora = +boton.dataset.hora;
    estado.mensajeError = "";
    pintarPaso2();
});

botonConfirmar.addEventListener("click", reservar);

botonOtraCita.addEventListener("click", () => {
    estado.reservaHecha = null;
    estado.fecha = null;
    estado.hora = null;
    estado.nota = "";
    estado.mensajeError = "";
    inputNota.value = "";
    mostrarPaso(1);
});

/* ---------- Suscripciones en tiempo real ---------- */

// Horario y servicios
onSnapshot(doc(baseDatos, "config", "main"), (instantanea) => {
    if (instantanea.exists()) {
        const normalizado = normalizarConfiguracion(instantanea.data());
        configuration = normalizado.configuration;
        services = normalizado.services;
    }
    pintarCabecera();
    pintarServicios();
    if (paso2.style.display !== "none" && !estado.guardando) pintarPaso2();
}, (error) => console.error("Error leyendo config:", error));

// Huecos ocupados (sin datos personales)
onSnapshot(
    query(collection(baseDatos, "cells"), where("date", ">=", formatearFechaAClave(new Date()))),
    (instantanea) => {
        estado.celdasOcupadas = new Set(instantanea.docs.map((d) => d.id));
        if (paso2.style.display !== "none" && !estado.guardando) pintarPaso2();
    },
    (error) => console.error("Error leyendo huecos:", error)
);

/* ---------- Arranque ---------- */
pintarCabecera();
pintarServicios();
botonPaso2.disabled = true;
mostrarPaso(1);