// Spec 009 (FR-002, FR-011, SC-005): la validación estricta de lo que devuelve la IA.
import { assertEquals, assertThrows } from '@std/assert'
import { InvalidEstimateError, parseEstimate, parseEstimateText } from './estimate.ts'

const item = (over: Record<string, unknown> = {}) => ({
  name: 'Milanesa al horno',
  quantity_text: '2 unidades',
  energy_kcal: 520,
  protein_g: 44,
  carbs_g: 30,
  fat_g: 24,
  ...over,
})

Deno.test('acepta una respuesta válida y la normaliza', () => {
  const items = parseEstimate({
    items: [item({ name: '  Puré  ', energy_kcal: 180.04, quantity_text: '  ' }), item()],
  })
  assertEquals(items[0], {
    name: 'Puré',
    quantity_text: null,
    energy_kcal: 180,
    protein_g: 44,
    carbs_g: 30,
    fat_g: 24,
  })
  assertEquals(items.length, 2)
})

Deno.test('los macros ausentes o nulos quedan vacíos, no cero', () => {
  const [one] = parseEstimate({ items: [{ name: 'Manzana', energy_kcal: 95 }] })
  assertEquals(one.protein_g, null)
  assertEquals(one.carbs_g, null)
  assertEquals(one.fat_g, null)
  assertEquals(one.quantity_text, null)
})

Deno.test('una lista vacía es válida', () => {
  assertEquals(parseEstimate({ items: [] }), [])
})

Deno.test('descarta lo que no tiene la forma esperada', () => {
  for (
    const bad of [null, 'texto', 7, [], {}, { items: 'x' }, { items: [null] }, { items: ['a'] }]
  ) {
    assertThrows(() => parseEstimate(bad), InvalidEstimateError)
  }
})

Deno.test('descarta más de 12 ítems', () => {
  const items = Array.from({ length: 13 }, () => item())
  assertThrows(() => parseEstimate({ items }), InvalidEstimateError, 'too_many_items')
  parseEstimate({ items: items.slice(0, 12) })
})

Deno.test('descarta nombres vacíos, largos o que no son texto', () => {
  for (const name of ['', '   ', 'a'.repeat(201), 5, null, undefined]) {
    assertThrows(() => parseEstimate({ items: [item({ name })] }), InvalidEstimateError)
  }
  parseEstimate({ items: [item({ name: 'a'.repeat(200) })] })
})

Deno.test('descarta cantidades de más de 60 caracteres o que no son texto', () => {
  assertThrows(
    () => parseEstimate({ items: [item({ quantity_text: 'a'.repeat(61) })] }),
    InvalidEstimateError,
  )
  assertThrows(() => parseEstimate({ items: [item({ quantity_text: 3 })] }), InvalidEstimateError)
})

Deno.test('descarta valores fuera de rango o que no son números', () => {
  const cases: Record<string, unknown>[] = [
    { energy_kcal: -1 },
    { energy_kcal: 5001 },
    { energy_kcal: 80000 },
    { energy_kcal: '300' },
    { energy_kcal: null },
    { energy_kcal: Number.NaN },
    { energy_kcal: Infinity },
    { protein_g: -0.1 },
    { carbs_g: 1001 },
    { fat_g: '10' },
  ]
  for (const over of cases) {
    assertThrows(() => parseEstimate({ items: [item(over)] }), InvalidEstimateError)
  }
})

Deno.test('un solo ítem inválido descarta toda la respuesta', () => {
  assertThrows(
    () => parseEstimate({ items: [item(), item({ energy_kcal: -5 })] }),
    InvalidEstimateError,
  )
})

Deno.test('parseEstimateText: JSON roto o con texto alrededor es inválido', () => {
  assertEquals(parseEstimateText(JSON.stringify({ items: [item()] })).length, 1)
  for (
    const text of ['', 'hola', '{"items": [', 'Aquí va: {"items":[]}', '```json\n{"items":[]}\n```']
  ) {
    assertThrows(() => parseEstimateText(text), InvalidEstimateError)
  }
})
