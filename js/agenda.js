import {
    baseDatos,
    MinutosAHora,
    convertirHoraAMinutos,
    formatearFechaAClave,
    obtenerEtiquetaFecha,
    calcularCeldasOcupadas,
    telefonoParaWhatsApp,
    escaparHTML
} from "./firebase.js";
import { autenticacion, EMAIL_ADMINISTRADORA } from "./auth.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const titulo = document.getElementById("salon-name");
const contenedor = document.getElementById("agenda-container");
const botonCerrarSesion = document.getElementById("btn-logout");

let citas = [];
let celdasOcupadas = new Set();
let propuesta = null; // { id, fecha, hora, error } mientras se edita una propuesta
let cancelarSuscripcionCitas = null;
let cancelarSuscripcionCeldas = null;

// Estados: pending (solicitud nueva), proposed (esperando a la clienta),
// declined (la clienta dijo que no), confirmed (cita firme). Sin estado = confirmed.
const estadoDe = (c) => c.status || "confirmed";
const enlaceEstado = (id) => new URL("../estado.html?id=" + id, window.location.href).href;
const claveAviso = (c) => `${estadoDe(c)}|${c.date}|${c.start}`;
const cuandoTexto = (c) => `${obtenerEtiquetaFecha(c.date)} a las ${MinutosAHora(c.start)}`;

/* ---------- Acceso solo para la administradora ---------- */

onAuthStateChanged(autenticacion, (usuario) => {
    const esAdmin = !!usuario?.email && usuario.email.toLowerCase() === EMAIL_ADMINISTRADORA.toLowerCase();
    if (!esAdmin) {
        window.location.href = "login.html";
        return;
    }
    suscribirseACitas();
    suscribirseACeldas();
    suscribirseANombreSalon();
});

function suscribirseANombreSalon() {
    onSnapshot(doc(baseDatos, "config", "main"), (instantanea) => {
        const nombre = instantanea.exists() && instantanea.data().configuration?.salon;
        if (nombre) titulo.textContent = nombre;
    }, () => {});
}

function suscribirseACitas() {
    if (cancelarSuscripcionCitas) cancelarSuscripcionCitas();
    const consulta = query(
        collection(baseDatos, "bookings"),
        where("date", ">=", formatearFechaAClave(new Date()))
    );
    cancelarSuscripcionCitas = onSnapshot(consulta, (instantanea) => {
        citas = instantanea.docs.map((d) => ({ id: d.id, ...d.data() }));
        pintarAgenda();
    }, (error) => {
        console.error("Error leyendo citas:", error);
        contenedor.innerHTML = `<div class="card err">No se pudieron cargar las citas. Comprueba las reglas de Firestore y vuelve a entrar.</div>`;
    });
}

// Huecos ocupados: sirven para comprobar que una hora propuesta está libre
function suscribirseACeldas() {
    if (cancelarSuscripcionCeldas) cancelarSuscripcionCeldas();
    const consulta = query(
        collection(baseDatos, "cells"),
        where("date", ">=", formatearFechaAClave(new Date()))
    );
    cancelarSuscripcionCeldas = onSnapshot(consulta, (instantanea) => {
        celdasOcupadas = new Set(instantanea.docs.map((d) => d.id));
    }, (error) => console.error("Error leyendo huecos:", error));
}

/* ---------- Pintado ---------- */

function botonAviso(c) {
    const st = estadoDe(c);
    if (st !== "confirmed" && st !== "proposed") return "";

    const enlace = enlaceEstado(c.id);
    const texto = st === "confirmed"
        ? `Hola ${c.name}, tu cita de ${c.service} el ${cuandoTexto(c)} está confirmada ✅. Puedes verla aquí: ${enlace}`
        : `Hola ${c.name}, a esa hora no me viene bien. ¿Te iría bien el ${cuandoTexto(c)}? Pulsa aquí para decirme sí o no: ${enlace}`;
    const href = `https://wa.me/${telefonoParaWhatsApp(c.phone)}?text=${encodeURIComponent(texto)}`;

    const yaAvisada = c.notif === claveAviso(c);
    const etiqueta = yaAvisada
        ? "✓ Avisada · volver a enviar"
        : `📲 Avisar a ${escaparHTML(c.name)} por WhatsApp`;
    return `<a class="wa ${yaAvisada ? "hecho" : ""}" href="${href}" target="_blank" rel="noopener" data-avisar="${escaparHTML(c.id)}">${etiqueta}</a>`;
}

function panelPropuesta(c) {
    const hoy = formatearFechaAClave(new Date());
    return `
    <div class="panel">
        <label>Nuevo día</label>
        <input type="date" data-prop-fecha min="${hoy}" value="${escaparHTML(propuesta.fecha)}">
        <label>Nueva hora</label>
        <input type="time" data-prop-hora step="900" value="${escaparHTML(propuesta.hora)}">
        <p class="err">${escaparHTML(propuesta.error || "")}</p>
        <div class="acciones">
            <button class="si" data-prop-enviar>Guardar propuesta</button>
            <button data-prop-cancelar>Cancelar</button>
        </div>
    </div>`;
}

function tarjeta(c, conFecha) {
    const st = estadoDe(c);
    const telefono = escaparHTML(c.phone);
    const horas = `${MinutosAHora(c.start)}–${MinutosAHora(c.end)}`;
    const cuando = conFecha ? `${obtenerEtiquetaFecha(c.date)} · ${horas}` : horas;
    const pidio = c.prev ? `Pidió: ${obtenerEtiquetaFecha(c.prev.date)} a las ${MinutosAHora(c.prev.start)}` : "";

    let aviso = "";
    if (st === "proposed") aviso = `<p class="mut">Esperando respuesta de la clienta. ${escaparHTML(pidio)}</p>`;
    if (st === "declined") aviso = `<p class="err"><b>No le viene bien este horario.</b> Propón otro o borra la cita. ${escaparHTML(pidio)}</p>`;

    const editando = propuesta && propuesta.id === c.id;

    return `
    <div class="card">
        <div>
            <b>${cuando}</b> · ${escaparHTML(c.service)}<br>
            ${escaparHTML(c.name)} · <a href="tel:${telefono}" style="color:var(--ac)">${telefono}</a>
            ${c.note ? `<br><span class="mut">“${escaparHTML(c.note)}”</span>` : ""}
        </div>
        ${aviso}
        ${editando ? panelPropuesta(c) : `
        <div class="acciones">
            ${st === "pending" ? `<button class="si" data-aceptar="${escaparHTML(c.id)}">✔ Aceptar</button>` : ""}
            <button data-cambiar="${escaparHTML(c.id)}">Cambiar hora</button>
            <button class="x" data-borrar="${escaparHTML(c.id)}">Borrar</button>
        </div>
        ${botonAviso(c)}`}
    </div>`;
}

function pintarAgenda() {
    if (propuesta && !citas.some((c) => c.id === propuesta.id)) propuesta = null;

    const orden = (a, b) => a.date.localeCompare(b.date) || a.start - b.start;
    const porEstado = (st) => citas.filter((c) => estadoDe(c) === st).sort(orden);

    const nuevas = porEstado("pending");
    const propuestas = porEstado("proposed");
    const rechazadas = porEstado("declined");
    const confirmadas = porEstado("confirmed");

    document.title = nuevas.length ? `(${nuevas.length}) Agenda de Citas` : "Agenda de Citas";

    if (!citas.length) {
        contenedor.innerHTML = `<div class="card mut">No hay citas reservadas por ahora.</div>`;
        return;
    }

    let html = "";
    if (nuevas.length) {
        html += `<h2>🔔 Solicitudes nuevas (${nuevas.length})</h2>` + nuevas.map((c) => tarjeta(c, true)).join("");
    }
    if (rechazadas.length) {
        html += `<h2>❗ No les viene bien tu propuesta (${rechazadas.length})</h2>` + rechazadas.map((c) => tarjeta(c, true)).join("");
    }
    if (propuestas.length) {
        html += `<h2>⏳ Esperando respuesta (${propuestas.length})</h2>` + propuestas.map((c) => tarjeta(c, true)).join("");
    }
    if (confirmadas.length) {
        html += `<h2 style="margin-top:28px">✅ Citas confirmadas</h2>`;
        let fechaAnterior = "";
        for (const c of confirmadas) {
            if (c.date !== fechaAnterior) {
                html += `<h2>${obtenerEtiquetaFecha(c.date)}</h2>`;
                fechaAnterior = c.date;
            }
            html += tarjeta(c, false);
        }
    }
    contenedor.innerHTML = html;
}

/* ---------- Acciones ---------- */

async function aceptar(id) {
    try {
        await updateDoc(doc(baseDatos, "bookings", id), { status: "confirmed" });
    } catch (error) {
        console.error("Error al aceptar:", error);
        alert("No se pudo aceptar la cita.");
    }
}

async function marcarAvisada(id) {
    const cita = citas.find((c) => c.id === id);
    if (!cita) return;
    try {
        await updateDoc(doc(baseDatos, "bookings", id), { notif: claveAviso(cita) });
    } catch (error) {
        console.error("Error al marcar aviso:", error);
    }
}

function abrirPropuesta(id) {
    const cita = citas.find((c) => c.id === id);
    if (!cita) return;
    propuesta = { id, fecha: cita.date, hora: MinutosAHora(cita.start), error: "" };
    pintarAgenda();
}

async function enviarPropuesta() {
    const cita = citas.find((c) => c.id === propuesta.id);
    if (!cita) return;

    if (!propuesta.fecha || !propuesta.hora) {
        propuesta.error = "Elige el día y la hora.";
        pintarAgenda();
        return;
    }
    if (propuesta.fecha < formatearFechaAClave(new Date())) {
        propuesta.error = "Ese día ya ha pasado.";
        pintarAgenda();
        return;
    }

    const inicio = convertirHoraAMinutos(propuesta.hora);
    const fin = inicio + cita.dur;
    const nuevas = calcularCeldasOcupadas(inicio, fin).map((i) => propuesta.fecha + "_" + i);
    const viejas = cita.cells || [];

    // Solo cuentan como "choque" los huecos que no son de esta misma cita
    if (nuevas.some((id) => !viejas.includes(id) && celdasOcupadas.has(id))) {
        propuesta.error = "A esa hora ya hay otra cita. Prueba otra.";
        pintarAgenda();
        return;
    }

    const st = estadoDe(cita);
    const prev = (st === "proposed" || st === "declined") && cita.prev
        ? cita.prev
        : { date: cita.date, start: cita.start };

    try {
        const lote = writeBatch(baseDatos);
        viejas.filter((id) => !nuevas.includes(id))
            .forEach((id) => lote.delete(doc(baseDatos, "cells", id)));
        nuevas.filter((id) => !viejas.includes(id))
            .forEach((id) => lote.set(doc(baseDatos, "cells", id), { date: propuesta.fecha, i: Number(id.split("_")[1]) }));
        lote.update(doc(baseDatos, "bookings", cita.id), {
            date: propuesta.fecha,
            start: inicio,
            end: fin,
            cells: nuevas,
            status: "proposed",
            prev,
            notif: ""
        });
        await lote.commit();
        propuesta = null; // al llegar el cambio, la tarjeta mostrará el botón de WhatsApp
    } catch (error) {
        console.error("Error al proponer:", error);
        propuesta.error = "No se pudo guardar. Inténtalo de nuevo.";
        pintarAgenda();
    }
}

// Borrar libera también sus huecos
async function borrarCita(id) {
    const cita = citas.find((c) => c.id === id);
    if (!cita || !confirm("¿Borrar esta cita? La clienta no recibe ningún aviso automático.")) return;
    try {
        const lote = writeBatch(baseDatos);
        (cita.cells || []).forEach((idCelda) => lote.delete(doc(baseDatos, "cells", idCelda)));
        lote.delete(doc(baseDatos, "bookings", id));
        await lote.commit();
    } catch (error) {
        console.error("Error al borrar:", error);
        alert("No se pudo borrar la cita.");
    }
}

/* ---------- Eventos ---------- */

contenedor.addEventListener("click", (evento) => {
    const objetivo = evento.target;
    let boton;

    if ((boton = objetivo.closest("[data-avisar]"))) return marcarAvisada(boton.dataset.avisar); // el enlace se abre solo
    if ((boton = objetivo.closest("[data-aceptar]"))) return aceptar(boton.dataset.aceptar);
    if ((boton = objetivo.closest("[data-cambiar]"))) return abrirPropuesta(boton.dataset.cambiar);
    if ((boton = objetivo.closest("[data-borrar]"))) return borrarCita(boton.dataset.borrar);
    if (objetivo.closest("[data-prop-enviar]")) return enviarPropuesta();
    if (objetivo.closest("[data-prop-cancelar]")) {
        propuesta = null;
        pintarAgenda();
    }
});

// Guardamos lo que escribe sin repintar (si no, se perdería al llegar cambios en directo)
contenedor.addEventListener("input", (evento) => {
    if (!propuesta) return;
    if (evento.target.dataset.propFecha !== undefined) propuesta.fecha = evento.target.value;
    if (evento.target.dataset.propHora !== undefined) propuesta.hora = evento.target.value;
});

botonCerrarSesion.addEventListener("click", async (evento) => {
    evento.preventDefault();
    await signOut(autenticacion);
    window.location.href = "login.html";
});