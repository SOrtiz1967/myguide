// T062 (FR-021, FR-022): borradores locales de formularios, nunca con contraseñas y siempre purgables.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { discardDraft, draftKey, loadDraft, purgeAllDrafts, saveDraft } from '../../src/lib/drafts'

const schema = z.object({ heightCm: z.string(), timezone: z.string() })

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('drafts', () => {
  it('la clave tiene el formato draft:v1:<userId>:<formId>', () => {
    expect(draftKey('u1', 'profile')).toBe('draft:v1:u1:profile')
  })

  it('FR-021: guarda y recupera un borrador', () => {
    saveDraft('u1', 'profile', { heightCm: '180', timezone: 'UTC' })
    expect(loadDraft('u1', 'profile', schema)?.values).toEqual({ heightCm: '180', timezone: 'UTC' })
  })

  it('devuelve null si no hay borrador', () => {
    expect(loadDraft('u1', 'profile', schema)).toBeNull()
  })

  it('un borrador con datos inválidos se descarta y se elimina', () => {
    localStorage.setItem(
      draftKey('u1', 'profile'),
      JSON.stringify({ savedAt: 1, values: { heightCm: 180 } }),
    )
    expect(loadDraft('u1', 'profile', schema)).toBeNull()
    expect(localStorage.getItem(draftKey('u1', 'profile'))).toBeNull()
  })

  it('un borrador con JSON corrupto se descarta y se elimina', () => {
    localStorage.setItem(draftKey('u1', 'profile'), '{no es json')
    expect(loadDraft('u1', 'profile', schema)).toBeNull()
    expect(localStorage.getItem(draftKey('u1', 'profile'))).toBeNull()
  })

  it('FR-021: descartar elimina el borrador', () => {
    saveDraft('u1', 'profile', { heightCm: '180', timezone: 'UTC' })
    discardDraft('u1', 'profile')
    expect(loadDraft('u1', 'profile', schema)).toBeNull()
  })

  it('los borradores de una cuenta no se ven desde otra', () => {
    saveDraft('u1', 'profile', { heightCm: '180', timezone: 'UTC' })
    expect(loadDraft('u2', 'profile', schema)).toBeNull()
  })

  it('FR-022: purgar elimina TODOS los borradores de todas las cuentas y respeta lo demás', () => {
    saveDraft('u1', 'profile', { heightCm: '180', timezone: 'UTC' })
    saveDraft('u2', 'meal', { heightCm: '1', timezone: 'x' })
    localStorage.setItem('tema', 'oscuro')
    purgeAllDrafts()
    expect(Object.keys(localStorage).filter((k) => k.startsWith('draft:'))).toEqual([])
    expect(localStorage.getItem('tema')).toBe('oscuro')
  })

  it('Principio I: nunca guarda campos de contraseña ni de secretos', () => {
    saveDraft('u1', 'profile', {
      heightCm: '180',
      password: 'secreta',
      currentPassword: 'secreta',
      newPassword: 'secreta',
      confirmPassword: 'secreta',
      token: 'abc',
    })
    const stored = localStorage.getItem(draftKey('u1', 'profile')) ?? ''
    expect(stored).toContain('heightCm')
    expect(stored).not.toMatch(/password|secreta|token|abc/i)
  })

  it('si el almacenamiento no está disponible no lanza ni rompe el formulario', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError')
    })
    expect(() => saveDraft('u1', 'profile', { heightCm: '1' })).not.toThrow()
    expect(saveDraft('u1', 'profile', { heightCm: '1' })).toBe(false)
  })

  it('si leer falla devuelve null en lugar de lanzar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(loadDraft('u1', 'profile', schema)).toBeNull()
  })
})
