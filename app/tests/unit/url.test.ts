// T074: los enlaces que vienen de la base (licencia y sitio de cada fuente) solo pueden ser http(s).
import { describe, expect, it } from 'vitest'
import { safeHttpUrl } from '../../src/lib/url'

describe('safeHttpUrl', () => {
  it('acepta direcciones http y https', () => {
    expect(safeHttpUrl('https://opendatacommons.org/licenses/odbl/1-0/')).toBe(
      'https://opendatacommons.org/licenses/odbl/1-0/',
    )
    expect(safeHttpUrl('http://ejemplo.test/x')).toBe('http://ejemplo.test/x')
  })

  it('rechaza esquemas peligrosos y lo que no es una dirección absoluta', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '//ejemplo.test/x',
      '/relativa',
      'no es una url',
      '',
    ]) {
      expect(safeHttpUrl(bad), bad).toBeNull()
    }
  })

  it('rechaza direcciones con credenciales incrustadas', () => {
    expect(safeHttpUrl('https://usuario:clave@ejemplo.test/')).toBeNull()
  })
})
