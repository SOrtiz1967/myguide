// T014 (spec 006, FR-049, FR-053): errores del servidor traducidos a mensajes claros, sin texto crudo.
import { describe, expect, it } from 'vitest'
import { es } from '../../src/copy/es'
import { openSessionIdFromError, trainingErrorMessage } from '../../src/features/training/api'

const e = es.training.errors
const err = (message: string) => ({ message })

describe('trainingErrorMessage', () => {
  it('sesión vencida', () => {
    expect(trainingErrorMessage(err('session_expired: la sesion vencio'))).toBe(
      es.auth.sessionExpired,
    )
  })

  it('los códigos de estado', () => {
    expect(trainingErrorMessage(err('stale_revision: la sesion cambio'))).toBe(e.staleRevision)
    expect(trainingErrorMessage(err('invalid_transition: no se puede'))).toBe(e.invalidTransition)
    expect(trainingErrorMessage(err('invalid_date: fecha'))).toBe(e.invalidDate)
    expect(trainingErrorMessage(err('not_found: no existe'))).toBe(e.notFound)
  })

  it('una sesión en curso', () => {
    const message = 'session_in_progress:7f9c1b2e-1111-4222-8333-444455556666'
    expect(trainingErrorMessage(err(message))).toBe(e.sessionInProgress)
    expect(openSessionIdFromError(err(message))).toBe('7f9c1b2e-1111-4222-8333-444455556666')
    expect(openSessionIdFromError(err('not_found: x'))).toBeNull()
  })

  it('validaciones de rutinas', () => {
    expect(trainingErrorMessage(err('invalid_routine:name_required:name'))).toBe(
      e.routine.name_required,
    )
    expect(trainingErrorMessage(err('invalid_routine:too_many_exercises:exercises'))).toBe(
      e.routine.too_many_exercises,
    )
    expect(trainingErrorMessage(err('invalid_routine:inventado:name'))).toBe(e.saveFailed)
  })

  it('validaciones de sesiones', () => {
    expect(trainingErrorMessage(err('invalid_session:invalid_set:exercises'))).toBe(
      e.session.invalid_set,
    )
    expect(trainingErrorMessage(err('invalid_session:duplicate_id:exercises'))).toBe(
      e.session.duplicate_id,
    )
    expect(trainingErrorMessage(err('invalid_session:inventado:exercises'))).toBe(e.saveFailed)
  })

  it('lo desconocido devuelve null y nunca el texto crudo', () => {
    expect(trainingErrorMessage(err('boom: algo raro con datos de la persona'))).toBeNull()
    expect(trainingErrorMessage(null)).toBeNull()
    expect(trainingErrorMessage(new Error('x'))).toBeNull()
    for (const message of ['session_expired', 'stale_revision', 'invalid_session:invalid_set:x']) {
      expect(trainingErrorMessage(err(message))).not.toContain('invalid_')
    }
  })
})
