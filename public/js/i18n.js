const DICT = {
  en: {
    app_name: 'HERO Card', tagline: 'Daily safety observations, made simple.',
    email: 'Email', password: 'Password', sign_in: 'Sign in', signing_in: 'Signing in…',
    demo_accounts: 'Demo accounts', demo_pw: 'Password for all',
    worker: 'Employee', supervisor: 'Supervisor',
    nav_home: 'Home', nav_new: 'New card', nav_history: 'My cards', nav_profile: 'Profile',
    nav_dashboard: 'Dashboard', nav_cards: 'Cards', nav_team: 'Team',
    good_morning: 'Good morning', good_afternoon: 'Good afternoon', good_evening: 'Good evening',
    today_done: "Today's card is in", today_done_sub: 'Thanks for looking out for your crew.',
    today_pending: "Today's HERO Card is pending", today_pending_sub: 'It takes about a minute.',
    start_card: 'Start HERO Card', another_card: 'Add another card',
    streak: 'Day streak', total_cards: 'Cards submitted', safe_obs: 'Satisfactory (30d)', open_int: 'Open interventions',
    this_week: 'This week', recent: 'Recent cards', see_all: 'See all', no_cards: 'No cards yet.',
    // form
    step: 'Step', of: 'of', details: 'Details', review: 'Review & submit',
    mark_all_s: 'Mark all S', clear: 'Clear', next: 'Next', back: 'Back', submit: 'Submit card', submitting: 'Submitting…',
    legend_s: 'Satisfactory', legend_i: 'Intervention needed', legend_c: 'Corrected',
    na_hint: 'Leave blank if it does not apply.',
    completed_by: 'Card completed by', date: 'Date', time: 'Time', location: 'Location', craft: 'Craft', observer_id: 'Observer ID #',
    intervention_summary: 'Intervention summary', what_was_done: 'What was done?',
    summary_ph: 'Describe what you observed…', done_ph: 'Describe the action taken to correct it…',
    location_ph: 'e.g. Unit 200 – Pipe rack B',
    required_when: 'Required because you marked I or C.',
    observations: 'Observations', rated: 'rated',
    err_no_ratings: 'Rate at least one item.', err_location: 'Location is required.', err_summary: 'Please describe the intervention.',
    draft_restored: 'Draft restored', discard_draft: 'Discard draft',
    submitted_title: 'HERO Card submitted!', submitted_sub: 'Thanks for keeping the job safe.',
    saved_offline: 'Saved offline — it will sync automatically.', synced: 'Offline cards synced',
    go_home: 'Back to home', view_card: 'View card',
    // card detail
    card: 'Card', status_submitted: 'All satisfactory', status_open: 'Open', status_closed: 'Closed',
    by: 'by', reviewed_by: 'Closed by', close_card: 'Close intervention', close_comment: 'Supervisor comment',
    close_comment_ph: 'e.g. Verified on site, toolbox talk held.', confirm_close: 'Mark as corrected',
    closed_ok: 'Intervention closed', not_rated: 'Not applicable / not rated',
    // supervisor
    submitted_today: 'Submitted today', team_safe: 'Satisfactory observations', cards_period: 'Cards',
    last_n_days: 'Last {n} days', cards_per_day: 'Cards per day', top_risks: 'Top intervention items',
    by_category: 'Observations by category', missing_today: 'Missing today', all_in: 'Everyone has submitted today',
    leaderboard: 'Participation', export_csv: 'Export CSV', all: 'All', search: 'Search location, name…',
    any_worker: 'All workers', from: 'From', to: 'To', load_more: 'Load more', no_results: 'No cards match these filters.',
    team: 'Team', add_member: 'Add member', name: 'Full name', role: 'Role', temp_password: 'Temporary password',
    create: 'Create', cancel: 'Cancel', save: 'Save', active: 'Active', inactive: 'Inactive', last_card: 'Last card', never: 'Never',
    deactivate: 'Deactivate', activate: 'Activate', reset_pw: 'Reset password', new_password: 'New password',
    member_created: 'Member created', updated: 'Updated', none_open: 'No open interventions',
    // profile
    language: 'Language', install_app: 'Install app', install_sub: 'Add HERO Card to your home screen for one-tap access.',
    installed: 'App installed', change_password: 'Change password', current_password: 'Current password',
    password_changed: 'Password changed', sign_out: 'Sign out', reports_to: 'Reports to', appearance: 'Appearance',
    theme_system: 'System', theme_light: 'Light', theme_dark: 'Dark',
    offline: 'You are offline', pending_sync: '{n} card(s) waiting to sync',
    create_account: 'Create account', register_sub: 'Employee registration — it takes a minute.', register: 'Register', registering: 'Creating account…',
    register_here: 'Register here', no_account: "Don't have an account?", have_account: 'Already have an account?',
    worker_id: 'Employee ID', profession: 'Profession', profession_ph: 'e.g. Pipefitter', repeat_password: 'Repeat password',
    show_password: 'Show password', hide_password: 'Hide password', pw_hint: 'At least 8 characters, with letters and numbers. Stored encrypted (hashed).',
    welcome_new: 'Account created. Welcome!', err_password_mismatch: 'Passwords do not match.',
    share_card: 'Share card', download_pdf: 'Download PDF', send_email: 'Send by email', sends_to: 'Sends to', done: 'Done',
    pdf_ready: 'Downloading PDF…', email_explain: 'The card PDF is attached and sent to the email registered for this employee.',
    recipient: 'Recipient', attached: 'PDF attached', send: 'Send', sending: 'Sending…',
    email_sent: 'Email sent to {to}', email_preview: 'Test mode: email to {to} saved (SMTP not configured)',
    err_invalid_email: 'Enter a valid email address.', err_email_failed: 'The email could not be sent. Check the mail settings.',
    err_password_weak: 'Use at least one letter and one number.', err_password_too_long: 'Password is too long (max 128).',
    err_bad_origin: 'Request blocked for security. Reload the page.',
    app_updated: 'App updated to the latest version',
    err_generic: 'Something went wrong. Try again.', err_invalid_credentials: 'Wrong email or password.',
    err_too_many_attempts: 'Too many attempts. Wait 15 minutes.', err_wrong_password: 'Current password is incorrect.',
    err_password_too_short: 'Password must be at least 8 characters.', err_duplicate_user: 'Email or Observer ID already exists.',
    err_missing_fields: 'Fill in all required fields.',
  },
  es: {
    app_name: 'HERO Card', tagline: 'Observaciones de seguridad diarias, simples.',
    email: 'Correo', password: 'Contraseña', sign_in: 'Iniciar sesión', signing_in: 'Ingresando…',
    demo_accounts: 'Cuentas demo', demo_pw: 'Contraseña para todas',
    worker: 'Empleado', supervisor: 'Supervisor',
    nav_home: 'Inicio', nav_new: 'Nueva', nav_history: 'Mis tarjetas', nav_profile: 'Perfil',
    nav_dashboard: 'Panel', nav_cards: 'Tarjetas', nav_team: 'Equipo',
    good_morning: 'Buenos días', good_afternoon: 'Buenas tardes', good_evening: 'Buenas noches',
    today_done: 'Tarjeta de hoy enviada', today_done_sub: 'Gracias por cuidar a tu equipo.',
    today_pending: 'Tu HERO Card de hoy está pendiente', today_pending_sub: 'Toma aproximadamente un minuto.',
    start_card: 'Llenar HERO Card', another_card: 'Agregar otra tarjeta',
    streak: 'Días seguidos', total_cards: 'Tarjetas enviadas', safe_obs: 'Satisfactorias (30d)', open_int: 'Intervenciones abiertas',
    this_week: 'Esta semana', recent: 'Tarjetas recientes', see_all: 'Ver todas', no_cards: 'Aún no hay tarjetas.',
    step: 'Paso', of: 'de', details: 'Detalles', review: 'Revisar y enviar',
    mark_all_s: 'Todo S', clear: 'Limpiar', next: 'Siguiente', back: 'Atrás', submit: 'Enviar tarjeta', submitting: 'Enviando…',
    legend_s: 'Satisfactorio', legend_i: 'Requiere intervención', legend_c: 'Corregido',
    na_hint: 'Déjalo en blanco si no aplica.',
    completed_by: 'Tarjeta llenada por', date: 'Fecha', time: 'Hora', location: 'Ubicación', craft: 'Oficio', observer_id: 'ID de observador',
    intervention_summary: 'Resumen de la intervención', what_was_done: '¿Qué se hizo?',
    summary_ph: 'Describe lo que observaste…', done_ph: 'Describe la acción tomada para corregirlo…',
    location_ph: 'ej. Unidad 200 – Rack de tubería B',
    required_when: 'Obligatorio porque marcaste I o C.',
    observations: 'Observaciones', rated: 'evaluados',
    err_no_ratings: 'Evalúa al menos un punto.', err_location: 'La ubicación es obligatoria.', err_summary: 'Describe la intervención.',
    draft_restored: 'Borrador recuperado', discard_draft: 'Descartar borrador',
    submitted_title: '¡HERO Card enviada!', submitted_sub: 'Gracias por mantener el trabajo seguro.',
    saved_offline: 'Guardada sin conexión — se sincronizará sola.', synced: 'Tarjetas sin conexión sincronizadas',
    go_home: 'Volver al inicio', view_card: 'Ver tarjeta',
    card: 'Tarjeta', status_submitted: 'Todo satisfactorio', status_open: 'Abierta', status_closed: 'Cerrada',
    by: 'por', reviewed_by: 'Cerrada por', close_card: 'Cerrar intervención', close_comment: 'Comentario del supervisor',
    close_comment_ph: 'ej. Verificado en sitio, charla de seguridad realizada.', confirm_close: 'Marcar como corregida',
    closed_ok: 'Intervención cerrada', not_rated: 'No aplica / sin evaluar',
    submitted_today: 'Enviadas hoy', team_safe: 'Observaciones satisfactorias', cards_period: 'Tarjetas',
    last_n_days: 'Últimos {n} días', cards_per_day: 'Tarjetas por día', top_risks: 'Puntos con más intervenciones',
    by_category: 'Observaciones por categoría', missing_today: 'Faltan hoy', all_in: '¡Todos enviaron hoy!',
    leaderboard: 'Participación', export_csv: 'Exportar CSV', all: 'Todas', search: 'Buscar ubicación, nombre…',
    any_worker: 'Todos los trabajadores', from: 'Desde', to: 'Hasta', load_more: 'Cargar más', no_results: 'Ninguna tarjeta coincide.',
    team: 'Equipo', add_member: 'Agregar miembro', name: 'Nombre completo', role: 'Rol', temp_password: 'Contraseña temporal',
    create: 'Crear', cancel: 'Cancelar', save: 'Guardar', active: 'Activo', inactive: 'Inactivo', last_card: 'Última tarjeta', never: 'Nunca',
    deactivate: 'Desactivar', activate: 'Activar', reset_pw: 'Restablecer contraseña', new_password: 'Nueva contraseña',
    member_created: 'Miembro creado', updated: 'Actualizado', none_open: 'Sin intervenciones abiertas',
    language: 'Idioma', install_app: 'Instalar app', install_sub: 'Agrega HERO Card a tu pantalla de inicio.',
    installed: 'App instalada', change_password: 'Cambiar contraseña', current_password: 'Contraseña actual',
    password_changed: 'Contraseña actualizada', sign_out: 'Cerrar sesión', reports_to: 'Reporta a', appearance: 'Apariencia',
    theme_system: 'Sistema', theme_light: 'Claro', theme_dark: 'Oscuro',
    offline: 'Sin conexión', pending_sync: '{n} tarjeta(s) por sincronizar',
    create_account: 'Crear cuenta', register_sub: 'Registro de empleado — toma un minuto.', register: 'Registrarme', registering: 'Creando cuenta…',
    register_here: 'Regístrate aquí', no_account: '¿No tienes cuenta?', have_account: '¿Ya tienes cuenta?',
    worker_id: 'ID del trabajador', profession: 'Profesión', profession_ph: 'ej. Soldador', repeat_password: 'Repetir contraseña',
    show_password: 'Mostrar contraseña', hide_password: 'Ocultar contraseña', pw_hint: 'Mínimo 8 caracteres, con letras y números. Se guarda cifrada (hash).',
    welcome_new: 'Cuenta creada. ¡Bienvenido!', err_password_mismatch: 'Las contraseñas no coinciden.',
    share_card: 'Compartir tarjeta', download_pdf: 'Descargar PDF', send_email: 'Enviar por correo', sends_to: 'Se envía a', done: 'Listo',
    pdf_ready: 'Descargando PDF…', email_explain: 'Se adjunta el PDF de la tarjeta y se envía al correo registrado del empleado.',
    recipient: 'Destinatario', attached: 'PDF adjunto', send: 'Enviar', sending: 'Enviando…',
    email_sent: 'Correo enviado a {to}', email_preview: 'Modo prueba: correo a {to} guardado (SMTP sin configurar)',
    err_invalid_email: 'Escribe un correo válido.', err_email_failed: 'No se pudo enviar el correo. Revisa la configuración de correo.',
    err_password_weak: 'Usa al menos una letra y un número.', err_password_too_long: 'La contraseña es muy larga (máx. 128).',
    err_bad_origin: 'Solicitud bloqueada por seguridad. Recarga la página.',
    app_updated: 'App actualizada a la última versión',
    err_generic: 'Algo salió mal. Intenta de nuevo.', err_invalid_credentials: 'Correo o contraseña incorrectos.',
    err_too_many_attempts: 'Demasiados intentos. Espera 15 minutos.', err_wrong_password: 'La contraseña actual es incorrecta.',
    err_password_too_short: 'La contraseña debe tener al menos 8 caracteres.', err_duplicate_user: 'El correo o ID ya existe.',
    err_missing_fields: 'Completa los campos obligatorios.',
  },
};

let lang = localStorage.getItem('hc_lang') || (navigator.language || 'en').slice(0, 2);
if (!DICT[lang]) lang = 'en';
document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) {
  lang = DICT[l] ? l : 'en';
  localStorage.setItem('hc_lang', lang);
  document.documentElement.lang = lang;
}
export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
export const label = (obj) => obj[lang] || obj.en;

export function fmtDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', opts);
}
export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit' });
}
