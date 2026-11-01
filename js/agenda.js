import {
    autenticacion,
    baseDatos,
    EMAIL_ADMINISTRADORA,
    MinutosAHora,
    formatearFechaAClave,
    obtenerEtiquetaFecha,
    escaparHTML
} from "./firebase.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection,
    doc,
    onSnapshot,
    query,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const titulo = document.getElementById("salon-name");
const contenedor = document.getElementById("agenda-container");
const botonCerrarSesion = document.getElementById("btn-logout");

let citas = [];
let cancelarSuscripcionCitas = null;

/* ---------- Acceso solo para la administradora ---------- */

onAuthStateChanged(autenticacion, (usuario) => {
    const esAdmin = !!usuario?.email && usuario.email.toLowerCase() === EMAIL_ADMINISTRADORA.toLowerCase();
    if (!esAdmin) {
        window.location.href = "login.html";
        return;
    }
    suscribirseACitas();
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

/* ---------- Pintado ---------- */

function pintarAgenda() {
    if (!citas.length) {
        contenedor.innerHTML = `<div class="card mut">No hay citas reservadas por ahora.</div>`;
        return;
    }

    const ordenadas = [...citas].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    let html = "";
    let fechaAnterior = "";

    for (const cita of ordenadas) {
        if (cita.date !== fechaAnterior) {
            html += `<h2>${obtenerEtiquetaFecha(cita.date)}</h2>`;
            fechaAnterior = cita.date;
        }
        const telefono = escaparHTML(cita.phone);
        html += `
        <div class="card">
          <div class="row">
            <div>
                <b>${MinutosAHora(cita.start)}–${MinutosAHora(cita.end)}</b> · ${escaparHTML(cita.service)}<br>
              ${escaparHTML(cita.name)} · <a href="tel:${telefono}" style="color:var(--ac)">${telefono}</a>
              ${cita.note ? `<br><span class="mut">“${escaparHTML(cita.note)}”</span>` : ""}
            </div>
            <button class="x" data-borrar="${escaparHTML(cita.id)}">Borrar</button>
          </div>
        </div>`;
    }
    contenedor.innerHTML = html;
}

/* ---------- Borrar cita (libera también sus huecos) ---------- */

async function borrarCita(id) {
    const cita = citas.find((c) => c.id === id);
    if (!cita || !confirm("¿Borrar esta cita?")) return;
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

contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-borrar]");
    if (boton) borrarCita(boton.dataset.borrar);
});

botonCerrarSesion.addEventListener("click", async (evento) => {
    evento.preventDefault();
    await signOut(autenticacion);
    window.location.href = "login.html";
});