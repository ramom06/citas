import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./firebase.js";

export const EMAIL_ADMINISTRADORA = "rmartinespana@gmail.com";
export const autenticacion = getAuth(app);