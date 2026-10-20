// T020 (spec 005): acceso a datos del catálogo de ejercicios (contracts/database-api.md).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catalogHasExercises,
  exerciseErrorMessage,
  fetchExercise,
  searchExercises,
} from '../../src/features/exercises/api'
import { es } from '../../src/copy/es'
import { supabase } from '../../src/lib/supabase'

vi.mock('../../src/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
const mockedFrom = vi.mocked(supabase.from)
const mockedRpc = vi.mocked(supabase.rpc)

type Result = { data: unknown; error: { code?: string; message?: string } | null }

/** Un constructor de consultas falso: cada `from()` consume el siguiente resultado de la cola. */
function queue(...results: Result[]) {
  const calls: Array<{ table: string; filters: unknown[][]; select?: string }> = []
  mockedFrom.mockReset()
  mockedFrom.mockImplementation(((table: string) => {
    const result = results.shift() ?? { data: null, error: null }
    const call: { table: string; filters: unknown[][]; select?: string } = { table, filters: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {
      select: (columns: string) => {
        call.select = columns
        return chain
      },
      eq: (...args: unknown[]) => {
        call.filters.push(args)
        return chain
      },
      limit: () => chain,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (value: Result) => unknown) => resolve(result),
    }
    return chain
  }) as never)
  return calls
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  origin: 'own',
  source_item_id: null,
  imported_at: null,
  based_on_exercise_id: null,
  name: 'Mi ejercicio',
  name_status: 'original',
  original_name: null,
  aliases: [],
  measurement_type: 'reps_weight',
  primary_muscles: ['chest'],
  secondary_muscles: [],
  equipment: null,
  description: null,
  description_status: null,
  source: null,
  ...overrides,
})

beforeEach(() => {
  mockedFrom.mockReset()
  mockedRpc.mockReset()
})

describe('searchExercises', () => {
  const base = {
    q: 'sentadilla',
    scope: 'all',
    muscle: null,
    equipment: null,
    pageSize: 20,
    pageOffset: 0,
  } as const

  it('envía el texto, el origen, los filtros y la tanda a search_exercises', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null } as never)
    await searchExercises({
      ...base,
      scope: 'catalog',
      muscle: 'chest',
      equipment: 'barbell',
      pageOffset: 40,
    })
    expect(mockedRpc).toHaveBeenCalledWith('search_exercises', {
      q: 'sentadilla',
      scope: 'catalog',
      muscle_filter: 'chest',
      equipment_filter: 'barbell',
      page_size: 20,
      page_offset: 40,
    })
  })

  it('un texto vacío se envía como nulo (solo filtros) y los filtros vacíos también', async () => {
    mockedRpc.mockResolvedValue({ data: [], error: null } as never)
    await searchExercises({ ...base, q: '', muscle: 'chest' })
    expect(mockedRpc).toHaveBeenCalledWith(
      'search_exercises',
      expect.objectContaining({ q: null, muscle_filter: 'chest', equipment_filter: null }),
    )
  })

  it('devuelve las filas, o una lista vacía si no hay datos', async () => {
    mockedRpc.mockResolvedValueOnce({ data: [{ id: 'e1' }], error: null } as never)
    expect(await searchExercises(base)).toEqual([{ id: 'e1' }])
    mockedRpc.mockResolvedValueOnce({ data: null, error: null } as never)
    expect(await searchExercises(base)).toEqual([])
  })

  it('propaga el error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: { message: 'boom' } } as never)
    await expect(searchExercises(base)).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('catalogHasExercises', () => {
  it('distingue un catálogo vacío de una búsqueda sin coincidencias', async () => {
    const calls = queue({ data: null, error: null, count: 3 } as Result)
    // el doble devuelve el mismo objeto con `count`
    mockedFrom.mockImplementation((() => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        limit: () => Promise.resolve({ count: 3, error: null }),
      }
      return chain
    }) as never)
    expect(await catalogHasExercises()).toBe(true)
    expect(calls).toBeDefined()
  })
})

describe('fetchExercise', () => {
  it('devuelve el ejercicio con su fuente y sin original si no es una copia', async () => {
    const calls = queue({
      data: row({
        origin: 'imported',
        source: { id: 's1', slug: 'free-exercise-db', name: 'free-exercise-db' },
      }),
      error: null,
    })
    const exercise = await fetchExercise('e1')
    expect(exercise?.source?.name).toBe('free-exercise-db')
    expect(exercise?.based_on).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.table).toBe('exercises')
    expect(calls[0]?.filters).toEqual([['id', 'e1']])
  })

  it('una copia trae el nombre y el id del ejercicio en que se basa', async () => {
    const calls = queue(
      { data: row({ based_on_exercise_id: 'c1' }), error: null },
      { data: { id: 'c1', name: 'Sentadilla con barra' }, error: null },
    )
    const exercise = await fetchExercise('e1')
    expect(exercise?.based_on).toEqual({ id: 'c1', name: 'Sentadilla con barra' })
    expect(calls[1]?.filters).toEqual([['id', 'c1']])
  })

  it('si el original ya no se puede leer, la copia se muestra sin original', async () => {
    queue({ data: row({ based_on_exercise_id: 'c1' }), error: null }, { data: null, error: null })
    expect((await fetchExercise('e1'))?.based_on).toBeNull()
  })

  it('un ejercicio inexistente o ajeno da null', async () => {
    queue({ data: null, error: null })
    expect(await fetchExercise('nada')).toBeNull()
  })

  it('un identificador con formato inválido se trata como inexistente', async () => {
    queue({ data: null, error: { code: '22P02' } })
    expect(await fetchExercise('no-es-un-uuid')).toBeNull()
  })

  it('otro error se propaga', async () => {
    queue({ data: null, error: { code: '500' } })
    await expect(fetchExercise('e1')).rejects.toEqual({ code: '500' })
  })
})

describe('exerciseErrorMessage: errores conocidos del servidor', () => {
  it.each([
    ['session_expired: la sesion vencio', es.auth.sessionExpired],
    ['query_too_short: escribe al menos 2 caracteres', es.exercises.searchTooShort],
    ['invalid_filter: el músculo no es válido', es.exercises.searchError],
    ['invalid_exercise:name_required:name', es.exercises.errors.nameRequired],
    ['invalid_exercise:name_too_long:name', es.exercises.errors.nameTooLong],
    [
      'invalid_exercise:measurement_required:measurement_type',
      es.exercises.errors.measurementRequired,
    ],
    ['invalid_exercise:too_many_muscles:primary_muscles', es.exercises.errors.tooManyPrimary],
    ['invalid_exercise:muscle_repeated:secondary_muscles', es.exercises.errors.muscleRepeated],
    ['invalid_exercise:description_too_long:description', es.exercises.errors.descriptionTooLong],
    ['invalid_exercise:too_many_aliases:aliases', es.exercises.errors.tooManyAliases],
    ['invalid_exercise:alias_too_long:aliases', es.exercises.errors.aliasTooLong],
    ['invalid_exercise:otra_cosa:x', es.exercises.errors.saveFailed],
  ])('«%s» → mensaje en español', (message, expected) => {
    expect(exerciseErrorMessage({ message })).toBe(expected)
  })

  it('un error desconocido no se traduce, y nunca se devuelve el texto del servidor', () => {
    expect(exerciseErrorMessage({ message: 'relation "exercises" does not exist' })).toBeNull()
    expect(exerciseErrorMessage(null)).toBeNull()
  })
})
