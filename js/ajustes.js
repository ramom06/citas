import { baseDatos, DIAS_SEMANA_LARGOS, normalizarConfiguracion, convertirHoraAMinutos, escaparHTML } from "./firebase.js";
import { autenticacion, EMAIL_ADMINISTRADORA } from "./auth.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Memoria temporal mientras se edita: { configuration: {...}, services: [{ n, time }] }
let borrador = normalizarConfiguracion(null);

const inputSalon = document.getElementById("cfg-salon");
const inputWhatsApp = document.getElementById("cfg-wa");
const inputDiasAntelacion = document.getElementById("cfg-days");
const selectIntervalo = document.getElementById("cfg-step");
const contenedorHorarios = document.getElementById("sched-list");
const contenedorServicios = document.getElementById("services-list");
const botonAgregarServicio = document.getElementById("btn-add-svc");
const botonGuardar = document.getElementById("btn-save");
const botonCerrarSesion = document.getElementById("btn-logout");

/* ---------- Acceso solo para la administradora ---------- */

onAuthStateChanged(autenticacion, (usuario) => {
    const esAdmin = !!usuario?.email && usuario.email.toLowerCase() === EMAIL_ADMINISTRADORA.toLowerCase();
    if (!esAdmin) {
        window.location.href = "login.html";
        return;
    }
    cargarConfiguracion();
});

async function cargarConfiguracion() {
    try {
        const instantanea = await getDoc(doc(baseDatos, "config", "main"));
        borrador = normalizarConfiguracion(instantanea.exists() ? instantanea.data() : null);
    } catch (error) {
        console.error("Error al cargar ajustes:", error);
        alert("No se pudieron cargar los ajustes guardados. Se muestran los valores por defecto.");
    }
    renderizarFormulario();
}

/* ---------- Pintado ---------- */

function renderizarFormulario() {
    const { configuration, services } = borrador;

    inputSalon.value = configuration.salon;
    inputWhatsApp.value = configuration.wa;
    inputDiasAntelacion.value = configuration.days;
    selectIntervalo.value = String(configuration.step);

    // De domingo (0) a sábado (6)
    contenedorHorarios.innerHTML = configuration.schedule.map((dia, i) => `
        <div class="row" style="align-items:center;margin-top:10px;gap:8px">
            <label style="margin:0;min-width:110px;font-weight:500">
                <input type="checkbox" style="width:auto" data-dia-activo="${i}" ${dia.c ? "" : "checked"}>
                ${DIAS_SEMANA_LARGOS[i]}
            </label>
            <input type="time" data-dia-apertura="${i}" value="${dia.o}" ${dia.c ? "disabled" : ""}>
            <input type="time" data-dia-cierre="${i}" value="${dia.x}" ${dia.c ? "disabled" : ""}>
        </div>
    `).join("");

    contenedorServicios.innerHTML = services.map((service, i) => `
        <div class="row" style="align-items:center;margin-top:10px;gap:8px">
            <input data-svc-nombre="${i}" value="${escaparHTML(service.n)}">
            <input data-svc-duracion="${i}" type="number" min="5" step="5" value="${service.time}" style="width:84px">
            <span class="mut">min</span>
            <button class="x" data-svc-eliminar="${i}">✕</button>
        </div>
    `).join("");
}

/* ---------- Edición ---------- */

document.addEventListener("input", (evento) => {
    const control = evento.target;
    const { configuration, services } = borrador;

    if (control.id === "cfg-salon") configuration.salon = control.value;
    else if (control.id === "cfg-wa") configuration.wa = control.value.replace(/\D/g, "");
    else if (control.id === "cfg-days") configuration.days = Math.max(1, Math.min(60, +control.value || 14));
    else if (control.id === "cfg-step") configuration.step = +control.value;

    else if (control.dataset.diaActivo !== undefined) {
        configuration.schedule[+control.dataset.diaActivo].c = !control.checked;
        renderizarFormulario(); // activa/desactiva los campos de hora
    }
    else if (control.dataset.diaApertura !== undefined) configuration.schedule[+control.dataset.diaApertura].o = control.value;
    else if (control.dataset.diaCierre !== undefined) configuration.schedule[+control.dataset.diaCierre].x = control.value;

    else if (control.dataset.svcNombre !== undefined) services[+control.dataset.svcNombre].n = control.value;
    else if (control.dataset.svcDuracion !== undefined) services[+control.dataset.svcDuracion].time = Math.max(5, +control.value || 30);
});

document.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-svc-eliminar]");
    if (!boton) return;
    borrador.services.splice(+boton.dataset.svcEliminar, 1);
    renderizarFormulario();
});

botonAgregarServicio.addEventListener("click", () => {
    borrador.services.push({ n: "Nuevo servicio", time: 30 });
    renderizarFormulario();
});

/* ---------- Guardar ---------- */

botonGuardar.addEventListener("click", async () => {
    const { configuration, services } = borrador;

    if (!services.length || services.some((s) => !s.n.trim())) {
        alert("Cada servicio debe tener un nombre válido.");
        return;
    }

    const horarioInvalido = configuration.schedule.some(
        (dia) => !dia.c && (!dia.o || !dia.x || convertirHoraAMinutos(dia.o) >= convertirHoraAMinutos(dia.x))
    );
    if (horarioInvalido) {
        alert("Comprueba el horario: la hora de apertura debe ser anterior a la de cierre.");
        return;
    }

    botonGuardar.disabled = true;
    try {
        await setDoc(doc(baseDatos, "config", "main"), {
            configuration,
            services: services.map((s) => ({ n: s.n.trim(), time: s.time }))
        });
        alert("Ajustes guardados. Los clientes ya ven los cambios.");
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("No se pudieron guardar los ajustes.");
    }
    botonGuardar.disabled = false;
});

botonCerrarSesion.addEventListener("click", async (evento) => {
    evento.preventDefault();
    await signOut(autenticacion);
    window.location.href = "login.html";
});