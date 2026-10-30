import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const EMAIL_ADMINISTRADORA = "rmartinespana@gmail.com";

export const app = initializeApp(FIREBASE_CONFIG);
export const baseDatos = getFirestore(app);
export const autenticacion = getAuth(app);

export const DIAS_SEMANA_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const DIAS_SEMANA_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCYuUoNwb40sz1SdrAFUs8_1UOiv7qFWWM",
    authDomain: "citas-d8273.firebaseapp.com",
    projectId: "citas-d8273",
    appId: "1:694909879847:web:8fedd1ed7006492a0b3002"
};



//De texto legible a total minutos (más facil cálculos)
export function HoraAMinutos(horaTexto) {
    let [horas, minutos] = horaTexto.split(":");
    return parseInt(horas) * 60 + parseInt(minutos);
}

//De mints a texto legible (09:05)
export function MinutosAHora(minutosTotales) {
    let horas = Math.floor(minutosTotales / 60);
    let minutos = minutosTotales % 60;
    return String(horas).padStart(2, "0") + ":" + String(minutos).padStart(2, "0");
}

export function formatearFechaAClave(fechaObjeto) {
    let dia = String(fechaObjeto.getDate()).padStart(2, "0");
    let mes = String(fechaObjeto.getMonth() + 1).padStart(2, "0");
    let anio = fechaObjeto.getFullYear();
    return `${dia}-${mes}-${anio}`;
}


export function convertirClaveAObjetoDate(claveFecha) {
    let [dia, mes, anio] = claveFecha.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
}

//Convierte una clave "dd-mm-aaaa" a etiqueta legible. (30-10-2026 -> vie 30/10)
export function obtenerEtiquetaFecha(claveFecha) {
    let fecha = convertirClaveAObjetoDate(claveFecha);
    let diaSemana = fecha.getDay(); // 0 = Domingo
    let dia = fecha.getDate();
    let mes = fecha.getMonth() + 1;
    return `${DIAS_SEMANA_CORTOS[diaSemana]} ${dia}/${mes}`;
}


//Divide el tiempo en bloques fijos de 15 minutos para control de concurrencia.
export function calcularCeldasOcupadas(minutoInicio, minutoFin) {
    let celdas = [];
    let celdaInicial = Math.floor(minutoInicio / 15);
    let celdaFinal = Math.ceil(minutoFin / 15);

    for (let i = celdaInicial; i < celdaFinal; i++) {
    celdas.push(i);
    }
    return celdas;
}

/**
 * Previene inyecciones XSS al renderizar texto introducido por clientes.
 */
export function escaparHTML(cadena) {
    return String(cadena).replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caracter]));
}