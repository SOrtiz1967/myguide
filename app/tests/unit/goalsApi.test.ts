// Acceso a datos del objetivo (spec 004, contracts/database-api.md): historial y set_energy_goal.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchGoalHistory, saveGoal } from '../../src/features/goals/api'
import { WriteError } from '../../src/lib/mutation'
import { supabase } from '../../src/lib/supabase'

vi.mock('../../src/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
const mockedFrom = vi.mocked(supabase.from)
const mockedRpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  mockedFrom.mockReset()
  mockedRpc.mockReset()
})

describe('fetchGoalHistory', () => {
  it('pide los cambios del más nuevo al más viejo, con un tope defensivo de 1.000 filas', async () => {
    const calls: Record<string, unknown[]> = {}
    const rows = [{ effective_from: '2026-10-12', kcal: 1800, created_at: '2026-10-12T21:30:00Z' }]
    const chain: Record<string, unknown> = {
      select: (...args: unknown[]) => ((calls.select = args), chain),
      order: (...args: unknown[]) => ((calls.order = args), chain),
      limit: (...args: unknown[]) => (
        (calls.limit = args),
        Promise.resolve({ data: rows, error: null })
      ),
    }
    mockedFrom.mockReturnValue(chain as never)

    await expect(fetchGoalHistory()).resolves.toEqual(rows)
    expect(mockedFrom).toHaveBeenCalledWith('energy_goals')
    expect(calls.select).toEqual(['effective_from, kcal, created_at'])
    expect(calls.order).toEqual(['created_at', { ascending: false }])
    expect(calls.limit).toEqual([1000])
  })

  it('un historial vacío es una lista vacía', async () => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: null, error: null }),
    }
    mockedFrom.mockReturnValue(chain as never)
    await expect(fetchGoalHistory()).resolves.toEqual([])
  })

  it('propaga el error', async () => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    }
    mockedFrom.mockReturnValue(chain as never)
    await expect(fetchGoalHistory()).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('saveGoal', () => {
  it('llama a set_energy_goal con el valor, la solicitud y la zona del dispositivo', async () => {
    mockedRpc.mockResolvedValue({
      data: { effective_from: '2026-10-19', kcal: 2000 },
      error: null,
    } as never)
    const saved = await saveGoal(2000, 'req-1')
    expect(saved).toEqual({ effective_from: '2026-10-19', kcal: 2000 })
    expect(mockedRpc).toHaveBeenCalledWith('set_energy_goal', {
      kcal: 2000,
      request_id: 'req-1',
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  })

  it('quitar el objetivo envía kcal nulo', async () => {
    mockedRpc.mockResolvedValue({
      data: { effective_from: '2026-10-19', kcal: null },
      error: null,
    } as never)
    await saveGoal(null, 'req-2')
    expect(mockedRpc).toHaveBeenCalledWith(
      'set_energy_goal',
      expect.objectContaining({ kcal: null }),
    )
  })

  it('una sesión vencida se informa con su mensaje, no con el texto del servidor', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { message: 'session_expired: la sesion vencio', code: '42501' },
    } as never)
    const failure = await saveGoal(2000, 'req-3').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(WriteError)
    expect((failure as WriteError).message).toBe(es.auth.sessionExpired)
    expect((failure as WriteError).network).toBe(false)
  })

  it('un valor fuera de rango se informa con el mensaje del rango', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { message: 'invalid_goal:out_of_range:kcal', code: '22023' },
    } as never)
    const failure = await saveGoal(500, 'req-4').catch((e: unknown) => e)
    expect((failure as WriteError).message).toBe(es.goal.validation.range)
  })

  it('cualquier otro fallo usa el mensaje genérico, sin el texto crudo', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "x" does not exist' },
    } as never)
    const failure = await saveGoal(2000, 'req-5').catch((e: unknown) => e)
    expect((failure as WriteError).message).toBe(es.errors.generic)
  })

  it('un corte de red es un WriteError de red', async () => {
    mockedRpc.mockRejectedValue(new TypeError('Failed to fetch'))
    const failure = await saveGoal(2000, 'req-6').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(WriteError)
    expect((failure as WriteError).network).toBe(true)
  })
})
