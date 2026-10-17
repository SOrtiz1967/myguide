// T058 (FR-016) y FR-031: zona horaria del dispositivo, validación IANA y formato regional.
import { describe, expect, it, vi } from 'vitest'
import { formatDate, formatHeight } from '../../src/lib/format'
import { detectDeviceTimezone, isValidTimezone, listTimezones } from '../../src/lib/timezone'

describe('zona horaria', () => {
  it('FR-016: detecta la zona horaria del dispositivo', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'America/Argentina/Buenos_Aires',
    } as Intl.ResolvedDateTimeFormatOptions)
    expect(detectDeviceTimezone()).toBe('America/Argentina/Buenos_Aires')
    vi.restoreAllMocks()
  })

  it('valida nombres IANA', () => {
    expect(isValidTimezone('America/Argentina/Buenos_Aires')).toBe(true)
    expect(isValidTimezone('Europe/Madrid')).toBe(true)
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Marte/Fobos')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
  })

  it('lista las zonas disponibles e incluye la de Buenos Aires', () => {
    const zones = listTimezones()
    // ICU lista el nombre canónico (America/Buenos_Aires); la base de datos acepta ambos nombres.
    expect(zones.some((zone) => zone.endsWith('Buenos_Aires'))).toBe(true)
    expect(zones.length).toBeGreaterThan(100)
  })
})

describe('formato regional (es-AR)', () => {
  it('FR-031: la fecha se muestra día/mes/año', () => {
    expect(formatDate('1990-05-17')).toBe('17/05/1990')
    expect(formatDate('2000-01-02')).toBe('02/01/2000')
  })

  it('la fecha no se corre un día por la zona horaria', () => {
    expect(formatDate('1990-01-01')).toBe('01/01/1990')
  })

  it('FR-015: la altura lleva su unidad y la coma decimal regional', () => {
    expect(formatHeight(171.5)).toBe('171,5 cm')
    expect(formatHeight(180)).toBe('180 cm')
  })
})
