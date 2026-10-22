// T019 (spec 006, FR-045, FR-046, FR-047, FR-048): borrador local, autoguardado, revisión y conflicto.
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaleRevisionError, type SaveResult } from '../../src/features/training/api'
import { draftFromSession, emptyDraft } from '../../src/features/training/sessionEditorState'
import { useSessionEditor } from '../../src/features/training/useSessionEditor'
import { draftKey } from '../../src/lib/drafts'
import { WriteError } from '../../src/lib/mutation'
import type { SessionDraft } from '../../src/features/training/schema'

const USER = 'u1'
const SESSION = 's1'
const KEY = draftKey(USER, `workout-${SESSION}`)

const press = {
  id: 'x1',
  exercise_id: 'e1',
  exercise_name: 'Press',
  measurement_type: 'reps_weight' as const,
}

const ok = (revision: number): SaveResult => ({
  revision,
  status: 'in_progress',
  modified: false,
  corrected_at: null,
  finished_at: null,
})

function setup(options: Partial<Parameters<typeof useSessionEditor>[0]> = {}) {
  const save =
    (options.save as ReturnType<typeof vi.fn> | undefined) ?? vi.fn().mockResolvedValue(ok(2))
  const loadServer = vi.fn().mockResolvedValue({ revision: 5, draft: emptyDraft() })
  const hook = renderHook(() =>
    useSessionEditor({
      userId: USER,
      sessionId: SESSION,
      initial: { revision: 1, draft: emptyDraft() },
      loadServer,
      debounceMs: 1000,
      ...options,
      save: save as unknown as Parameters<typeof useSessionEditor>[0]['save'],
    }),
  )
  return { ...hook, save, loadServer }
}

const addPress = (hook: ReturnType<typeof setup>) =>
  act(() => hook.result.current.dispatch({ type: 'addExercise', exercise: press }))
const typeReps = (hook: ReturnType<typeof setup>, value: string) =>
  act(() =>
    hook.result.current.dispatch({
      type: 'editSet',
      exerciseId: 'x1',
      index: 0,
      field: 'reps',
      value,
    }),
  )

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('borrador local (FR-045)', () => {
  it('guarda el borrador en cada cambio', () => {
    const hook = setup()
    addPress(hook)
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.values.session.exercises[0].exercise_name).toBe('Press')
    expect(stored.values.revision).toBe(1)
  })

  it('sin cambios no deja nada guardado', () => {
    setup()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('recupera un borrador distinto de lo guardado en el servidor', () => {
    const draft: SessionDraft = { note: 'a medias', exercises: [] }
    localStorage.setItem(
      KEY,
      JSON.stringify({ savedAt: Date.now(), values: { revision: 1, session: draft } }),
    )
    const hook = setup()
    expect(hook.result.current.restored).toBe(true)
    expect(hook.result.current.draft.note).toBe('a medias')
    expect(hook.result.current.conflict).toBe(false)
  })

  it('descartar lo recuperado vuelve a lo del servidor y borra el borrador', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        values: { revision: 1, session: { note: 'x', exercises: [] } },
      }),
    )
    const hook = setup()
    act(() => hook.result.current.discardRestored())
    expect(hook.result.current.draft.note).toBe('')
    expect(hook.result.current.restored).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('un borrador igual a lo del servidor no se presenta como recuperado', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ savedAt: Date.now(), values: { revision: 1, session: emptyDraft() } }),
    )
    expect(setup().result.current.restored).toBe(false)
  })

  it('un borrador hecho sobre una revisión vieja marca conflicto', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        values: { revision: 1, session: { note: 'x', exercises: [] } },
      }),
    )
    const hook = setup({ initial: { revision: 3, draft: emptyDraft() } })
    expect(hook.result.current.restored).toBe(true)
    expect(hook.result.current.conflict).toBe(true)
  })
})

describe('autoguardado (FR-046)', () => {
  it('guarda tras un retardo, con el último estado, en una sola solicitud', async () => {
    const hook = setup()
    addPress(hook)
    typeReps(hook, '8')
    expect(hook.save).not.toHaveBeenCalled()
    expect(hook.result.current.indicator).toBe('unsaved')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.save).toHaveBeenCalledTimes(1)
    const [payload, revision, finish] = hook.save.mock.calls[0]!
    expect(revision).toBe(1)
    expect(finish).toBe(false)
    expect(payload.exercises[0].sets).toEqual([{ reps: 8 }])
  })

  it('«Guardado» solo cuando el servidor responde, y entonces borra el borrador local', async () => {
    let resolve: (r: SaveResult) => void = () => {}
    const hook = setup({
      save: vi.fn(() => new Promise<SaveResult>((r) => (resolve = r))),
    })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.result.current.indicator).toBe('saving')
    expect(localStorage.getItem(KEY)).not.toBeNull()
    await act(async () => resolve(ok(2)))
    expect(hook.result.current.indicator).toBe('saved')
    expect(hook.result.current.revision).toBe(2)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('una sola solicitud en vuelo: un cambio mientras guarda se envía después, con la revisión nueva', async () => {
    const resolvers: Array<(r: SaveResult) => void> = []
    const save = vi.fn((..._args: unknown[]) => new Promise<SaveResult>((r) => resolvers.push(r)))
    const hook = setup({ save })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).toHaveBeenCalledTimes(1)
    typeReps(hook, '9')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).toHaveBeenCalledTimes(1) // todavía espera la respuesta
    await act(async () => resolvers[0]!(ok(2)))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]![1]).toBe(2)
    expect(
      (save.mock.calls[1]![0] as { exercises: Array<{ sets: unknown }> }).exercises[0]!.sets,
    ).toEqual([{ reps: 9 }])
  })

  it('sin conexión no llama al servidor y lo dice', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const hook = setup()
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.save).not.toHaveBeenCalled()
    expect(hook.result.current.indicator).toBe('offline')
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })

  it('un fallo de red conserva el borrador y reintentar guarda', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new WriteError(true, 'offline'))
      .mockResolvedValue(ok(2))
    const hook = setup({ save })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.result.current.indicator).toBe('offline')
    expect(localStorage.getItem(KEY)).not.toBeNull()
    await act(async () => {
      await hook.result.current.retry()
    })
    expect(hook.result.current.indicator).toBe('saved')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('un fallo del servidor se dice distinto de uno de red', async () => {
    const save = vi.fn().mockRejectedValue(new WriteError(false, 'No pudimos guardar'))
    const hook = setup({ save })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.result.current.indicator).toBe('failed')
  })

  it('un borrador con un valor inválido no se envía y muestra el error', async () => {
    const hook = setup()
    addPress(hook)
    typeReps(hook, '1000')
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(hook.save).not.toHaveBeenCalled()
    expect(hook.result.current.indicator).toBe('unsaved')
    expect(hook.result.current.built.ok).toBe(false)
  })

  it('sin autoguardado (corrección de una sesión realizada) solo guarda a pedido', async () => {
    const hook = setup({ autosave: false })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(hook.save).not.toHaveBeenCalled()
    await act(async () => {
      await hook.result.current.saveNow()
    })
    expect(hook.save).toHaveBeenCalledTimes(1)
  })
})

describe('terminar (FR-012)', () => {
  it('guarda con finish y devuelve el resultado', async () => {
    const hook = setup()
    addPress(hook)
    let outcome: unknown
    await act(async () => {
      outcome = await hook.result.current.finish()
    })
    expect(outcome).toMatchObject({ kind: 'ok' })
    expect(hook.save).toHaveBeenCalledWith(expect.anything(), 1, true)
  })

  it('con valores inválidos no llama al servidor', async () => {
    const hook = setup()
    addPress(hook)
    typeReps(hook, '0')
    let outcome: unknown
    await act(async () => {
      outcome = await hook.result.current.finish()
    })
    expect(outcome).toMatchObject({ kind: 'invalid' })
    expect(hook.save).not.toHaveBeenCalled()
  })
})

describe('conflicto de revisión (FR-045)', () => {
  async function conflicted() {
    const hook = setup({ save: vi.fn().mockRejectedValue(new StaleRevisionError()) })
    addPress(hook)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    return hook
  }

  it('lo expone y deja de autoguardar', async () => {
    const hook = await conflicted()
    expect(hook.result.current.conflict).toBe(true)
    typeReps(hook, '5')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(hook.save).toHaveBeenCalledTimes(1)
  })

  it('conservar la del servidor reemplaza lo local y borra el borrador', async () => {
    const hook = await conflicted()
    const serverDraft = draftFromSession({ note: 'del servidor', session_exercises: [] })
    hook.loadServer.mockResolvedValue({ revision: 5, draft: serverDraft })
    await act(async () => {
      await hook.result.current.resolveConflict('server')
    })
    expect(hook.result.current.conflict).toBe(false)
    expect(hook.result.current.draft.note).toBe('del servidor')
    expect(hook.result.current.revision).toBe(5)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('conservar la de este dispositivo toma la revisión del servidor y guarda lo local', async () => {
    const hook = await conflicted()
    hook.save.mockResolvedValue(ok(6))
    await act(async () => {
      await hook.result.current.resolveConflict('mine')
    })
    expect(hook.result.current.conflict).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(hook.save).toHaveBeenLastCalledWith(expect.anything(), 5, false)
    expect(hook.result.current.draft.exercises[0]!.exercise_name).toBe('Press')
  })
})
