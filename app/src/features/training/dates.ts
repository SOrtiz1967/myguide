// Fechas de entrenamiento (spec 006). Una sesión es de un día calendario, como texto «AAAA-MM-DD», en la zona de la
// persona; el servidor decide el «hoy» real, pero la pantalla necesita uno para limitar el campo de fecha.

/** Hoy en la zona del dispositivo: '2026-10-22'. */
export function todayLocal(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA').format(now)
}
