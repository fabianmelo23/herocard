# HERO Card Digital

PWA (instalable en celular y PC) para llenar la HERO Card diaria de seguridad, con perfil de **Empleado** y **Supervisor**.

## Ejecutar

```powershell
npm install
npm start
```

Abrir http://localhost:3000 · Requiere Node.js 22.13+ (usa la base de datos SQLite integrada en `node:sqlite`).

Cuentas demo (contraseña `Hero2026!`):

| Rol        | Correo                    |
|------------|---------------------------|
| Supervisor | supervisor@herocard.app   |
| Empleado   | worker@herocard.app       |

La base de datos se crea en `data/herocard.db` con 14 días de datos de ejemplo. Para reiniciarla, borra la carpeta `data/`.

## Funciones

- **Empleado:** tarjeta paso a paso (5 categorías + detalles) con botones S / I / C, "Todo S" por sección, borrador guardado automáticamente, resumen obligatorio si hay I o C, racha diaria, historial.
- **Supervisor:** panel con cumplimiento del día, intervenciones abiertas, % satisfactorio, tarjetas por día, puntos con más intervenciones, observaciones por categoría y participación; lista de tarjetas con filtros; cerrar intervenciones (I → C) con comentario; gestión del equipo; exportar CSV.
- **PWA:** instalable, funciona sin conexión (las tarjetas se guardan y se sincronizan al volver la señal), modo claro/oscuro, inglés/español.

## Estructura

- `server/` – API Express + SQLite (`db.js` esquema y datos demo, `index.js` rutas, `auth.js` contraseñas scrypt + sesiones con cookie HttpOnly)
- `public/` – app (HTML/CSS/JS sin framework), `sw.js` service worker, `manifest.webmanifest`
- `public/js/checklist.js` – los puntos de la tarjeta (compartido por servidor y cliente)

## Para producción

Servir detrás de HTTPS (obligatorio para instalar la PWA fuera de localhost), cambiar las contraseñas demo y respaldar `data/herocard.db`.
