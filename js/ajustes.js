import {
    autenticacion,
    baseDatos,
    EMAIL_ADMINISTRADORA,
    DIAS_SEMANA_LARGOS,
    convertirHoraAMinutos,
    escaparHTML
} from "./firebase.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Horarios por defecto (Domingo = 0 cerrado, resto abierto)
const HORARIO_DEFECTO = { open: "09:30", close: "20:00" };

//Funciona como memoria temporal mientras edita
let borradorConfiguracion = {
    configuration: {
        salon: "Maria Godoy",
        wa: "34744644953",
        step: 30,
        days: 14,
        schedule: [
          { c: true },                         // 0: Domingo (cerrado, sin horarios)
          { c: false, ...HORARIO_DEFECTO },    // 1: Lunes
          { c: false, ...HORARIO_DEFECTO },    // 2: Martes
          { c: false, ...HORARIO_DEFECTO },    // 3: Miércoles
          { c: false, ...HORARIO_DEFECTO },    // 4: Jueves
          { c: false, ...HORARIO_DEFECTO },    // 5: Viernes
          { c: false, ...HORARIO_DEFECTO }     // 6: Sábado
        ]
    },
    services: [
        { service: "Corte", time: 30 },
        { service: "Lavado y peinado", time: 45 }
    ] 
};

const inputSalon = document.getElementById("cfg-salon");
const inputWhatsApp = document.getElementById("cfg-wa");
const inputDiasAntelacion = document.getElementById("cfg-days");
const selectIntervalo = document.getElementById("cfg-step");
const contenedorHorarios = document.getElementById("sched-list");
const contenedorServicios = document.getElementById("services-list");
const botonAgregarServicio = document.getElementById("btn-add-svc");
const botonGuardar = document.getElementById("btn-save");
const botonCerrarSesion = document.getElementById("btn-logout");

onAuthStateChanged(autenticacion, (usuario) => {
  const esAdmin = usuario && usuario.email?.toLowerCase() === EMAIL_ADMINISTRADORA.toLowerCase();
  if (!esAdmin) {
    window.location.href = "login.html";
    return;
  }
  cargarConfiguracionDesdeFirestore();
});

async function cargarConfiguracionDesdeFirestore() {
  try {
    const instantanea = await getDoc(doc(baseDatos, "config", "main"));
    if (instantanea.exists()) {
      const datosRemotos = instantanea.data();
      if (datosRemotos.cfg) {
        borradorConfiguracion.cfg = { ...borradorConfiguracion.cfg, ...datosRemotos.cfg };
      }
      if (datosRemotos.services?.length) {
        borradorConfiguracion.services = datosRemotos.services;
      }
    }
    renderizarFormulario();
  } catch (error) {
    console.error("Error al cargar ajustes:", error);
  }
}

function renderizarFormulario() {
  inputSalon.value = borradorConfiguracion.cfg.salon;
  inputWhatsApp.value = borradorConfiguracion.cfg.wa;
  inputDiasAntelacion.value = borradorConfiguracion.cfg.days;
  selectIntervalo.value = borradorConfiguracion.cfg.step;

  // Renderiza de Domingo (0) a Sábado (6)
  contenedorHorarios.innerHTML = borradorConfiguracion.cfg.sched.map((dia, indice) => `
    <div class="row" style="display:flex;align-items:center;margin-top:10px;gap:8px">
      <label style="margin:0;min-width:110px;font-weight:500">
        <input type="checkbox" data-dia-activo="${indice}" ${dia.c ? "" : "checked"}>
        ${DIAS_SEMANA_LARGOS[indice]}
      </label>
      <input type="time" data-dia-apertura="${indice}" value="${dia.o}">
      <input type="time" data-dia-cierre="${indice}" value="${dia.x}">
    </div>
  `).join("");

  contenedorServicios.innerHTML = borradorConfiguracion.services.map((servicio, indice) => `
    <div class="row" style="display:flex;align-items:center;margin-top:10px;gap:8px">
      <input data-svc-nombre="${indice}" value="${escaparHTML(servicio.n)}">
      <input data-svc-duracion="${indice}" type="number" min="5" step="5" value="${servicio.m}" style="width:84px">
      <span class="mut">min</span>
      <button class="x" data-svc-eliminar="${indice}">✕</button>
    </div>
  `).join("");
}

document.addEventListener("input", (evento) => {
  const control = evento.target;

  if (control.id === "cfg-salon") borradorConfiguracion.cfg.salon = control.value;
  if (control.id === "cfg-wa") borradorConfiguracion.cfg.wa = control.value.replace(/\D/g, "");
  if (control.id === "cfg-days") borradorConfiguracion.cfg.days = Math.max(1, Math.min(60, +control.value || 14));
  if (control.id === "cfg-step") borradorConfiguracion.cfg.step = +control.value;

  if (control.dataset.diaActivo !== undefined) {
    const idx = +control.dataset.diaActivo;
    borradorConfiguracion.cfg.sched[idx].c = !control.checked;
  }
  if (control.dataset.diaApertura !== undefined) {
    const idx = +control.dataset.diaApertura;
    borradorConfiguracion.cfg.sched[idx].o = control.value;
  }
  if (control.dataset.diaCierre !== undefined) {
    const idx = +control.dataset.diaCierre;
    borradorConfiguracion.cfg.sched[idx].x = control.value;
  }

  if (control.dataset.svcNombre !== undefined) {
    const idx = +control.dataset.svcNombre;
    borradorConfiguracion.services[idx].n = control.value;
  }
  if (control.dataset.svcDuracion !== undefined) {
    const idx = +control.dataset.svcDuracion;
    borradorConfiguracion.services[idx].m = Math.max(5, +control.value || 30);
  }
});

document.addEventListener("click", (evento) => {
  if (evento.target.dataset.svcEliminar !== undefined) {
    const indice = +evento.target.dataset.svcEliminar;
    borradorConfiguracion.services.splice(indice, 1);
    renderizarFormulario();
  }
});

botonAgregarServicio.addEventListener("click", () => {
  borradorConfiguracion.services.push({ n: "Nuevo servicio", m: 30 });
  renderizarFormulario();
});

botonGuardar.addEventListener("click", async () => {
  if (!borradorConfiguracion.services.length || borradorConfiguracion.services.some((s) => !s.n.trim())) {
    alert("Cada servicio debe tener un nombre válido.");
    return;
  }

  const horarioInvalido = borradorConfiguracion.cfg.sched.some(
    (dia) => !dia.c && convertirHoraAMinutos(dia.o) >= convertirHoraAMinutos(dia.x)
  );
  if (horarioInvalido) {
    alert("Comprueba el horario: la hora de apertura debe ser anterior a la hora de cierre.");
    return;
  }

  try {
    await setDoc(doc(baseDatos, "config", "main"), {
      cfg: borradorConfiguracion.cfg,
      services: borradorConfiguracion.services
    });
    alert("Ajustes guardados correctamente.");
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Hubo un error al guardar los ajustes en el servidor.");
  }
});

botonCerrarSesion.addEventListener("click", async (evento) => {
  evento.preventDefault();
  await signOut(autenticacion);
  window.location.href = "login.html";
});