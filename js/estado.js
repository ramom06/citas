import {
    baseDatos,
    MinutosAHora,
    obtenerEtiquetaFecha,
    normalizarConfiguracion,
    escaparHTML
} from "./firebase.js";

import {
    doc,
    onSnapshot,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const id = new URLSearchParams(window.location.search).get("id");
const contenedor = document.getElementById("estado-container");
const titulo = document.getElementById("salon-name");

let cita = null;
let cargada = false;

function botonWhatsApp(texto) {
    if (!whatsapp) return "";
    return `<a class="wa" target="_blank" rel="noopener" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}">Escribir por WhatsApp</a>`;
}

function pintar() {
    if (!cargada) return;

    if (!cita) {
        contenedor.innerHTML = `
            <p><b>No encontramos esta cita.</b></p>
            <p class="mut">Puede que se haya cancelado o que el enlace esté incompleto.</p>`;
        return;
    }

    const estado = cita.status || "confirmed";
    const cuando = `${obtenerEtiquetaFecha(cita.date)} a las ${MinutosAHora(cita.start)}`;
    const detalle = `<p><b>${escaparHTML(cita.service)}</b><br>${cuando} (${cita.dur} min)</p>`;

    if (estado === "pending") {
        contenedor.innerHTML = `
            <p><b>⏳ Solicitud recibida</b></p>
            ${detalle}
            <p class="mut">Te escribiremos por WhatsApp para confirmarte la hora. Puedes guardar esta página para ver cómo va.</p>`;
    } else if (estado === "confirmed") {
        contenedor.innerHTML = `
            <p class="ok">✅ ¡Cita confirmada!</p>
            ${detalle}
            <p class="mut">Te esperamos. Si no puedes venir, respóndenos al WhatsApp que te enviamos.</p>`;
    } else if (estado === "proposed") {
        const antes = cita.prev
            ? `<p class="mut">Tú pedías: ${obtenerEtiquetaFecha(cita.prev.date)} a las ${MinutosAHora(cita.prev.start)}</p>`
            : "";
        contenedor.innerHTML = `
            <p><b>📅 Hemos cambiado tu cita</b></p>
            ${antes}
            ${detalle}
            <p>¿Te viene bien la nueva hora?</p>
            <button class="p" data-respuesta="confirmed">Sí, la acepto</button>
            <button data-respuesta="declined" style="width:100%;margin-top:8px">No me viene bien</button>`;
    } else if (estado === "declined") {
        contenedor.innerHTML = `
            <p><b>Has indicado que ese horario no te viene bien.</b></p>
            <p class="mut">Se lo hemos comunicado a la peluquera. Te escribirá por WhatsApp con otra hora.</p>`;
    }
}

async function responder(respuesta, botones) {
    botones.forEach((b) => (b.disabled = true));
    try {
        await updateDoc(doc(baseDatos, "bookings", id), { status: respuesta });
    } catch (error) {
        console.error("Error al responder:", error);
        alert("No se pudo enviar tu respuesta. Inténtalo de nuevo.");
        botones.forEach((b) => (b.disabled = false));
    }
}

contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-respuesta]");
    if (!boton) return;
    responder(boton.dataset.respuesta, [...contenedor.querySelectorAll("[data-respuesta]")]);
});

if (!id) {
    cargada = true;
    pintar();
} else {
    onSnapshot(doc(baseDatos, "config", "main"), (instantanea) => {
        const { configuration } = normalizarConfiguracion(instantanea.exists() ? instantanea.data() : null);
        titulo.textContent = configuration.salon;
    }, () => {});

    onSnapshot(doc(baseDatos, "bookings", id), (instantanea) => {
        cita = instantanea.exists() ? instantanea.data() : null;
        cargada = true;
        pintar();
    }, (error) => {
        console.error("Error leyendo la cita:", error);
        cita = null;
        cargada = true;
        pintar();
    });
}