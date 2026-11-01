import { autenticacion, EMAIL_ADMINISTRADORA } from "./auth.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const inputEmail = document.getElementById("em");
const inputPassword = document.getElementById("pw");
const textoError = document.getElementById("err");
const botonEntrar = document.getElementById("btn-login");

const esAdmin = (usuario) =>
    !!usuario?.email && usuario.email.toLowerCase() === EMAIL_ADMINISTRADORA.toLowerCase();

// Si ya hay sesión de administradora, directa a la agenda
onAuthStateChanged(autenticacion, (usuario) => {
    if (esAdmin(usuario)) window.location.href = "agenda.html";
});

async function entrar() {
    textoError.textContent = "";
    botonEntrar.disabled = true;
    try {
        const credencial = await signInWithEmailAndPassword(
            autenticacion,
            inputEmail.value.trim(),
            inputPassword.value
        );
        if (!esAdmin(credencial.user)) {
            await signOut(autenticacion);
            textoError.textContent = "Esta cuenta no tiene acceso de administradora.";
        }
        // Si es la administradora, onAuthStateChanged redirige a la agenda.
    } catch (error) {
        console.error("Error de login:", error);
        textoError.textContent = "Email o contraseña incorrectos.";
    }
    botonEntrar.disabled = false;
}

botonEntrar.addEventListener("click", entrar);
[inputEmail, inputPassword].forEach((input) =>
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") entrar();
    })
);