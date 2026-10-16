// FR-016: zona horaria del dispositivo y validación de nombres IANA.

export function detectDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Zonas disponibles para elegir. Incluye UTC, que Intl no siempre lista. */
export function listTimezones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false
  try {
    new Intl.DateTimeFormat('es-AR', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
