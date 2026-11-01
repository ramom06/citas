import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// La config va ANTES de initializeApp (si no, da "Cannot access before initialization").
// La apiKey de Firebase no es secreta: la seguridad la dan las reglas de Firestore.
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCYuUoNwb40sz1SdrAFUs8_1UOiv7qFWWM",
    authDomain: "citas-d8273.firebaseapp.com",
    projectId: "citas-d8273",
    appId: "1:694909879847:web:8fedd1ed7006492a0b3002"
};

export const EMAIL_ADMINISTRADORA = "rmartinespana@gmail.com";

export const app = initializeApp(FIREBASE_CONFIG);
export const baseDatos = getFirestore(app);
export const autenticacion = getAuth(app);

export const DIAS_SEMANA_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const DIAS_SEMANA_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* ---------- Configuración por defecto y normalización ---------- */

export const HORARIO_DEFECTO = { o: "09:30", x: "20:00" };

export const SERVICIOS_DEFECTO = [
    { n: "Corte", time: 30 },
    { n: "Lavado y peinado", time: 45 },
    { n: "Corte y peinado", time: 60 },
    { n: "Tinte", time: 90 },
    { n: "Mechas", time: 150 },
    { n: "Mechas y corte", time: 180 },
    { n: "Recogido", time: 60 }
];

// c = cerrado (true) / abierto (false); o = apertura; x = cierre. Índice 0 = domingo.
export function crearConfiguracionDefecto() {
    return {
        salon: "Peluquería",
        wa: "34744644953",
        step: 30,
        days: 14,
        schedule: [
            { c: true, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO },
            { c: false, ...HORARIO_DEFECTO }
        ]
    };
}

/**
 * Convierte lo que haya en Firestore (config/main) en { configuration, services } siempre completo.
 * Acepta servicios guardados como {n, time} o {n, m} y los deja como {n, time}.
 */
export function normalizarConfiguracion(datosRemotos) {
    const base = crearConfiguracionDefecto();
    const remoteConfiguration = datosRemotos?.configuration || {};
    const configuration = { ...base, ...remoteConfiguration };

    configuration.schedule = base.schedule.map((porDefecto, i) => {
        const s = remoteConfiguration.schedule?.[i] || porDefecto;
        return {
            c: !!s.c,
            o: s.o || HORARIO_DEFECTO.o,
            x: s.x || HORARIO_DEFECTO.x
        };
    });

    let services = SERVICIOS_DEFECTO.map((s) => ({ ...s }));
    if (Array.isArray(datosRemotos?.services) && datosRemotos.services.length) {
        services = datosRemotos.services.map((s) => ({
            n: String(s.n ?? ""),
            time: Number(s.time) || 30
        }));
    }
    return { configuration, services };
}

/* ---------- Horas ---------- */

// De "09:05" a minutos totales (más fácil para calcular)
export function convertirHoraAMinutos(horaTexto) {
    const [horas, minutos] = horaTexto.split(":");
    return parseInt(horas, 10) * 60 + parseInt(minutos, 10);
}
export const HoraAMinutos = convertirHoraAMinutos; // alias por compatibilidad

// De minutos totales a "09:05"
export function MinutosAHora(minutosTotales) {
    const horas = Math.floor(minutosTotales / 60);
    const minutos = minutosTotales % 60;
    return String(horas).padStart(2, "0") + ":" + String(minutos).padStart(2, "0");
}

export function formatearDuracion(minutos) {
    if (minutos < 60) return minutos + " min";
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return h + " h" + (m ? " " + m + " min" : "");
}

/* ---------- Fechas ---------- */
// Formato aaaa-mm-dd: así el orden alfabético = orden cronológico,
// y las consultas where("date", ">=", ...) de Firestore funcionan.

export function formatearFechaAClave(fechaObjeto) {
    const anio = fechaObjeto.getFullYear();
    const mes = String(fechaObjeto.getMonth() + 1).padStart(2, "0");
    const dia = String(fechaObjeto.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

export function convertirClaveAObjetoDate(claveFecha) {
    const [anio, mes, dia] = claveFecha.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
}

// "2026-10-30" -> "vie 30/10"
export function obtenerEtiquetaFecha(claveFecha) {
    const fecha = convertirClaveAObjetoDate(claveFecha);
    return `${DIAS_SEMANA_CORTOS[fecha.getDay()]} ${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

/* ---------- Celdas de 15 min (control de concurrencia) ---------- */

export function calcularCeldasOcupadas(minutoInicio, minutoFin) {
    const celdas = [];
    const celdaInicial = Math.floor(minutoInicio / 15);
    const celdaFinal = Math.ceil(minutoFin / 15);
    for (let i = celdaInicial; i < celdaFinal; i++) {
        celdas.push(i);
    }
    return celdas;
}

/* ---------- Seguridad ---------- */

// Evita inyección de HTML (XSS) al pintar texto escrito por clientes.
export function escaparHTML(cadena) {
    return String(cadena).replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caracter]));
}