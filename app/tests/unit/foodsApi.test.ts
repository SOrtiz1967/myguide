// fetchFood (spec 002, FR-011, FR-020): el alimento con sus porciones, su fuente y el original de una copia.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFood } from '../../src/features/foods/api'
import { supabase } from '../../src/lib/supabase'

vi.mock('../../src/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const mockedFrom = vi.mocked(supabase.from)

type Result = { data: unknown; error: { code: string } | null }

/** Un constructor de consultas falso: cada `from()` consume el siguiente resultado de la cola. */
function queue(...results: Result[]) {
  const calls: Array<{ table: string; filters: unknown[][] }> = []
  mockedFrom.mockReset()
  mockedFrom.mockImplementation(((table: string) => {
    const result = results.shift() ?? { data: null, error: null }
    const call = { table, filters: [] as unknown[][] }
    calls.push(call)
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        call.filters.push(args)
        return chain
      },
      maybeSingle: () => Promise.resolve(result),
    }
    return chain
  }) as never)
  return calls
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'f1',
  origin: 'own',
  based_on_food_id: null,
  name: 'Mi alimento',
  portions: [
    { id: 'p2', name: 'Segunda', quantity: 20, position: 1 },
    { id: 'p1', name: 'Primera', quantity: 10, position: 0 },
  ],
  source: null,
  ...overrides,
})

beforeEach(() => mockedFrom.mockReset())

describe('fetchFood', () => {
  it('devuelve el alimento con las porciones en orden y sin original si no es una copia', async () => {
    const calls = queue({ data: row(), error: null })
    const food = await fetchFood('f1')
    expect(food?.portions.map((p) => p.name)).toEqual(['Primera', 'Segunda'])
    expect(food?.based_on).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('una copia trae el nombre y el id del alimento en que se basa', async () => {
    const calls = queue(
      { data: row({ based_on_food_id: 'c1' }), error: null },
      { data: { id: 'c1', name: 'Arroz blanco' }, error: null },
    )
    const food = await fetchFood('f1')
    expect(food?.based_on).toEqual({ id: 'c1', name: 'Arroz blanco' })
    expect(calls[1]?.table).toBe('foods')
    expect(calls[1]?.filters).toEqual([['id', 'c1']])
  })

  it('si el original ya no se puede leer, la copia se muestra sin original', async () => {
    queue({ data: row({ based_on_food_id: 'c1' }), error: null }, { data: null, error: null })
    expect((await fetchFood('f1'))?.based_on).toBeNull()
  })

  it('un alimento inexistente o ajeno da null', async () => {
    queue({ data: null, error: null })
    expect(await fetchFood('nada')).toBeNull()
  })

  it('un identificador con formato inválido se trata como inexistente', async () => {
    queue({ data: null, error: { code: '22P02' } })
    expect(await fetchFood('no-es-un-uuid')).toBeNull()
  })

  it('otro error se propaga', async () => {
    queue({ data: null, error: { code: '500' } })
    await expect(fetchFood('f1')).rejects.toEqual({ code: '500' })
  })
})
