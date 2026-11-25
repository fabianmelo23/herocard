# HERO Card Digital

PWA (instalable en celular y PC) para llenar la HERO Card diaria de seguridad, con perfil de **Empleado** y **Supervisor**.

## Ejecutar

```powershell
npm install
npm start
```

Abrir http://localhost:3000 · Requiere Node.js 22.13+ (usa la base de datos SQLite integrada en `node:sqlite`).

En modo demo (por defecto fuera de producción) se crean estas cuentas, contraseña `Hero2026!`:

| Rol        | Correo                    |
|------------|---------------------------|
| Supervisor | supervisor@herocard.app   |
| Empleado   | worker@herocard.app       |

La base de datos se crea en `data/herocard.db` con 14 días de datos de ejemplo. Para reiniciarla, borra la carpeta `data/`.

## Funciones

- **Empleado:** registro propio, tarjeta paso a paso con botones S / I / C (al marcar algo, "Siguiente" salta a Detalles), borrador automático, racha diaria, historial.
- **Supervisor:** panel (cumplimiento del día, intervenciones abiertas, % satisfactorio, tendencias), lista de tarjetas con filtros, cierre de intervenciones con comentario, **PDF de la tarjeta**, **envío por correo** al empleado, gestión del equipo, exportar CSV.
- **PWA:** instalable, funciona sin conexión (las tarjetas se guardan y sincronizan solas), aviso de actualización, modo claro/oscuro, inglés/español.

## Configuración (`.env`)

Copia `.env.example` a `.env`. Variables:

| Variable | Uso |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envío real de correos. Sin `SMTP_HOST`, los correos se guardan en `data/outbox/` (modo prueba). |
| `NODE_ENV=production` | Desactiva el modo demo (no se crean cuentas demo y el login no las muestra). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | En producción con base vacía, crea el primer supervisor. |
| `TRUST_PROXY=1` | Solo detrás de Nginx/proxy: confía en `X-Forwarded-*` (IP real, HTTPS, HSTS). |
| `HOST`, `PORT` | Dirección de escucha (por defecto `127.0.0.1:3000`). Usa `HOST=0.0.0.0` para probar desde otros equipos de la red. |

## Seguridad

- Contraseñas con **scrypt** + sal aleatoria (nunca en texto plano); mínimo 8 caracteres con letras y números.
- Sesiones en cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` con HTTPS); en la base solo se guarda el **hash SHA-256** del token. Cambiar la contraseña cierra las demás sesiones.
- Protección CSRF: las peticiones que modifican datos deben venir del mismo origen y en JSON.
- Cabeceras: Content-Security-Policy estricta, `X-Frame-Options: DENY`, `Permissions-Policy`, COOP/CORP, HSTS detrás de HTTPS.
- Límites de intentos: login por IP y por cuenta, registro por IP, cambio de contraseña y envío de correos.
- Login con tiempo constante (no revela qué correos existen).
- El correo de la tarjeta solo se envía al correo registrado del empleado (no se puede usar para enviar a terceros).
- Escapado de todo el contenido de usuario en la interfaz y protección contra inyección de fórmulas en el CSV.

## Estructura

- `server/` – API Express + SQLite: `index.js` rutas, `db.js` esquema y datos demo, `auth.js` contraseñas, `security.js` cabeceras/CSRF/límites, `pdf.js` PDF de la tarjeta, `mailer.js` correo.
- `public/` – app (HTML/CSS/JS sin framework): `css/app.css` base + `css/theme.css` capa visual, `sw.js` service worker, `manifest.webmanifest`.
- `public/js/checklist.js` – los puntos de la tarjeta (compartido por servidor y cliente).

## Producción

Servir detrás de HTTPS (obligatorio para instalar la PWA fuera de localhost) con `NODE_ENV=production` y `TRUST_PROXY=1`, y respaldar `data/herocard.db`.
