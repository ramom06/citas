# Reserva de citas para la peluquería (versión real)

Los clientes reservan desde su casa y las citas se guardan en Firebase (gratis para este uso).
La administradora entra desde el móvil o el portátil, con email y contraseña, y ve la agenda completa.

## Qué ve cada persona
- Clientes: solo el formulario de reserva y las horas libres (nunca los datos de otros clientes).
- Administradora: pestañas Reservar, Agenda y Ajustes (horario, servicios y duraciones).
  Desde Reservar también puede apuntar a mano las citas que le llegan por WhatsApp o Instagram.

## Paso 1. Crear el proyecto en Firebase (10 minutos)
1. Entra en https://console.firebase.google.com con una cuenta de Google y pulsa "Crear un proyecto". Desactiva Google Analytics.
2. En el menú: Compilación > Firestore Database > "Crear base de datos". Elige una región europea (por ejemplo eur3) y "modo de producción".
3. En Firestore, pestaña "Reglas": borra lo que haya, pega el contenido de `firestore.rules` y cambia el email `mama@ejemplo.com` por el de tu madre. Pulsa "Publicar".
4. Compilación > Authentication > "Comenzar" > método "Correo electrónico/contraseña" > actívalo.
5. En Authentication > pestaña "Usuarios" > "Añadir usuario": pon el email de tu madre y una contraseña que ella recuerde.
6. Ajustes del proyecto (rueda dentada) > "Tus apps" > icono web `</>` > registra la app. Te muestra un bloque `firebaseConfig` con apiKey, authDomain, projectId y appId.

## Paso 2. Configurar index.html
Abre `index.html` con el Bloc de notas y cambia, al principio del script:
- `FIREBASE={...}`: pega tus valores (apiKey, authDomain, projectId, appId).
- `ADMIN_EMAIL`: el email de tu madre (el mismo que en las reglas).

La apiKey de Firebase no es secreta: la seguridad la dan las reglas del paso 1.

## Paso 3. Publicar en GitHub Pages
1. Crea un repositorio en GitHub y sube `index.html`.
2. Settings > Pages > Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. Tu web quedará en `https://TU-USUARIO.github.io/NOMBRE-REPO/`. Ese es el enlace que se pone en la bio de Instagram y se manda por WhatsApp.

## Primer uso
1. Abre la web, pulsa "Acceso administradora" (abajo) y entra con el email y la contraseña.
2. En Ajustes revisa el horario, los servicios, sus minutos y el número de WhatsApp, y guarda.
3. Haz una reserva de prueba desde otro móvil y comprueba que aparece en Agenda.

## Notas
- Dos clientes no pueden coger la misma hora: la reserva se guarda de forma atómica y al segundo le sale un aviso.
- Borrar una cita desde Agenda libera el hueco.
- Cualquiera con el enlace puede reservar, así que alguien malintencionado podría ocupar huecos con citas falsas. Tu madre las borra desde Agenda. Si pasara a menudo, se puede añadir Firebase App Check.
- El plan gratuito de Firebase (Spark) de sobra para una peluquería de barrio.
