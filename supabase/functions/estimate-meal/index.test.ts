// Spec 009 (FR-001, FR-009 a FR-016, SC-003, SC-004, SC-006): la función `estimate-meal`, con el proveedor y la base simulados.
import { assert, assertEquals, assertFalse } from '@std/assert'
import type { EstimatedItem } from '../_shared/estimate.ts'
import { AiError, type AiErrorKind, type MealInput } from '../_shared/gemini.ts'
import { type EstimateDeps, handleEstimateMeal, MAX_PHOTO_BYTES, MAX_TEXT } from './handler.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const REQUEST = '22222222-2222-4222-8222-222222222222'
const SECRET_TEXT = 'dos milanesas con puré secreto-unico-42'

const ITEMS: EstimatedItem[] = [
  {
    name: 'Milanesa',
    quantity_text: '2 unidades',
    energy_kcal: 520,
    protein_g: 44,
    carbs_g: 30,
    fat_g: 24,
  },
  {
    name: 'Puré',
    quantity_text: null,
    energy_kcal: 180,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
  },
]

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/estimate-meal', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token-valido',
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const valid = (over: Record<string, unknown> = {}) => ({
  request_id: REQUEST,
  text: SECRET_TEXT,
  ...over,
})

function makeDeps(overrides: Partial<EstimateDeps> = {}) {
  const state = {
    calls: [] as MealInput[],
    cache: new Map<string, EstimatedItem[]>(),
    minuteHits: 0,
    dayHits: 0,
    logs: [] as string[],
  }
  const deps: EstimateDeps = {
    authenticate: (jwt) => Promise.resolve(jwt === 'token-valido' ? USER : null),
    configured: () => true,
    rateLimitMinute: () => {
      state.minuteHits++
      return Promise.resolve(true)
    },
    rateLimitDay: () => {
      state.dayHits++
      return Promise.resolve(true)
    },
    cache: {
      get: (user, id) => Promise.resolve(state.cache.get(`${user}:${id}`) ?? null),
      put: (user, id, _kind, items) => {
        state.cache.set(`${user}:${id}`, items)
        return Promise.resolve()
      },
    },
    estimate: (input) => {
      state.calls.push(input)
      return Promise.resolve(ITEMS)
    },
    newId: () => 'log-id',
    log: (level, message, fields) => {
      state.logs.push(JSON.stringify({ level, message, ...fields }))
    },
    ...overrides,
  }
  return { deps, state }
}

const json = async (response: Response) => (await response.json()) as Record<string, unknown>

Deno.test('estima y devuelve los ítems sin guardar nada más que el resultado', async () => {
  const { deps, state } = makeDeps()
  const response = await handleEstimateMeal(post(valid()), deps)
  assertEquals(response.status, 200)
  assertEquals(await json(response), { items: ITEMS, cached: false })
  assertEquals(state.calls, [{ text: SECRET_TEXT }])
  assertEquals(state.cache.size, 1)
})

Deno.test('el proveedor recibe solo el texto recortado', async () => {
  const { deps, state } = makeDeps()
  await handleEstimateMeal(
    post(valid({ text: '  una manzana  ', extra: 'x', user_id: 'otro' })),
    deps,
  )
  assertEquals(state.calls, [{ text: 'una manzana' }])
})

Deno.test('una solicitud repetida devuelve lo guardado sin llamar al proveedor ni contar cuota', async () => {
  const { deps, state } = makeDeps()
  await handleEstimateMeal(post(valid()), deps)
  const again = await handleEstimateMeal(post(valid()), deps)
  assertEquals(again.status, 200)
  assertEquals((await json(again)).cached, true)
  assertEquals(state.calls.length, 1)
  assertEquals(state.minuteHits, 1)
  assertEquals(state.dayHits, 1)
})

Deno.test('el resultado guardado es de la cuenta: otra cuenta con el mismo identificador consulta de nuevo', async () => {
  const { deps, state } = makeDeps({
    authenticate: (jwt) => Promise.resolve(jwt === 'token-b' ? 'otra-cuenta' : USER),
  })
  await handleEstimateMeal(post(valid()), deps)
  await handleEstimateMeal(post(valid(), { authorization: 'Bearer token-b' }), deps)
  assertEquals(state.calls.length, 2)
})

Deno.test('rechaza solicitudes inválidas antes de consultar', async () => {
  const bad: unknown[] = [
    valid({ text: '' }),
    valid({ text: '   ' }),
    valid({ text: 'a'.repeat(MAX_TEXT + 1) }),
    valid({ text: 12 }),
    valid({ request_id: 'no-es-uuid' }),
    valid({ request_id: undefined }),
    {},
    '{no es json',
    '[]',
  ]
  for (const body of bad) {
    const { deps, state } = makeDeps()
    const response = await handleEstimateMeal(post(body), deps)
    assertEquals(response.status, 400, JSON.stringify(body))
    assertEquals((await json(response)).code, 'invalid_request')
    assertEquals(state.calls.length, 0)
    assertEquals(state.minuteHits, 0)
  }
  const { deps } = makeDeps()
  const exact = await handleEstimateMeal(post(valid({ text: 'a'.repeat(MAX_TEXT) })), deps)
  assertEquals(exact.status, 200)
})

Deno.test('sin token, con token inválido o con origen no permitido', async () => {
  const { deps, state } = makeDeps()
  for (const headers of [{ authorization: '' }, { authorization: 'Bearer otro' }]) {
    const response = await handleEstimateMeal(post(valid(), headers), deps)
    assertEquals(response.status, 401)
  }
  const forbidden = await handleEstimateMeal(
    post(valid(), { origin: 'https://malo.example' }),
    deps,
  )
  assertEquals(forbidden.status, 403)
  assertEquals(state.calls.length, 0)
})

Deno.test('responde al preflight y rechaza otros métodos', async () => {
  const { deps } = makeDeps()
  const options = await handleEstimateMeal(
    new Request('http://localhost/x', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(options.status, 204)
  const get = await handleEstimateMeal(
    new Request('http://localhost/x', {
      method: 'GET',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(get.status, 405)
})

Deno.test('sin clave configurada responde ai_unavailable y no cuenta cuota', async () => {
  const { deps, state } = makeDeps({ configured: () => false })
  const response = await handleEstimateMeal(post(valid()), deps)
  assertEquals(response.status, 503)
  assertEquals((await json(response)).code, 'ai_unavailable')
  assertEquals(state.minuteHits, 0)
})

Deno.test('el límite por minuto y por día corta antes de llamar al proveedor', async () => {
  const minute = makeDeps({ rateLimitMinute: () => Promise.resolve(false) })
  const m = await handleEstimateMeal(post(valid()), minute.deps)
  assertEquals(m.status, 429)
  assertEquals((await json(m)).code, 'rate_limited')
  assertEquals(minute.state.calls.length, 0)

  const day = makeDeps({ rateLimitDay: () => Promise.resolve(false) })
  const d = await handleEstimateMeal(post(valid()), day.deps)
  assertEquals(d.status, 429)
  assertEquals((await json(d)).code, 'daily_limit')
  assertEquals(day.state.calls.length, 0)
})

Deno.test('cada fallo del proveedor tiene su código y no se guarda como resultado', async () => {
  const expected: Record<AiErrorKind, [number, string]> = {
    quota: [429, 'quota_exhausted'],
    timeout: [504, 'ai_timeout'],
    failed: [502, 'ai_failed'],
    invalid: [502, 'ai_invalid'],
  }
  for (const [kind, [status, code]] of Object.entries(expected)) {
    const { deps, state } = makeDeps({
      estimate: () => Promise.reject(new AiError(kind as AiErrorKind)),
    })
    const response = await handleEstimateMeal(post(valid()), deps)
    assertEquals(response.status, status, kind)
    assertEquals((await json(response)).code, code)
    assertEquals(state.cache.size, 0, 'un fallo no se guarda')
  }
})

Deno.test('un error inesperado también cae al camino manual con ai_failed', async () => {
  const { deps } = makeDeps({
    estimate: () => Promise.reject(new Error('boom con secreto-unico-42')),
  })
  const response = await handleEstimateMeal(post(valid()), deps)
  assertEquals(response.status, 502)
  assertEquals((await json(response)).code, 'ai_failed')
})

Deno.test('si la IA no encuentra alimentos responde no_items', async () => {
  const { deps, state } = makeDeps({ estimate: () => Promise.resolve([]) })
  const response = await handleEstimateMeal(post(valid({ text: 'nada' })), deps)
  assertEquals(response.status, 422)
  assertEquals((await json(response)).code, 'no_items')
  assertEquals(state.cache.size, 0)
})

Deno.test('si la caché falla igual responde con la estimación', async () => {
  const { deps } = makeDeps({
    cache: {
      get: () => Promise.reject(new Error('caída')),
      put: () => Promise.reject(new Error('caída')),
    },
  })
  const response = await handleEstimateMeal(post(valid()), deps)
  assertEquals(response.status, 200)
  assertEquals((await json(response)).items, ITEMS)
})

Deno.test('los registros no contienen el texto, los ítems, los valores ni la persona', async () => {
  const { deps, state } = makeDeps()
  await handleEstimateMeal(post(valid()), deps)
  await handleEstimateMeal(post(valid()), deps)
  const failing = makeDeps({ estimate: () => Promise.reject(new AiError('quota')) })
  await handleEstimateMeal(
    post(valid({ request_id: '33333333-3333-4333-8333-333333333333' })),
    failing.deps,
  )

  const all = [...state.logs, ...failing.state.logs].join('\n')
  assert(all.includes('estimate_meal'))
  for (
    const forbidden of [
      'secreto-unico-42',
      'Milanesa',
      'Puré',
      USER,
      REQUEST,
      '520',
      'token-valido',
    ]
  ) {
    assertFalse(all.includes(forbidden), `el registro no debe contener ${forbidden}`)
  }
  assert(all.includes('"result":"ok"') && all.includes('"result":"cached"'))
  assert(failing.state.logs.join('').includes('"result":"quota_exhausted"'))
})

// Historia 6: la foto del plato ------------------------------------------------------------------------------------

const readFixture = (name: string) =>
  Deno.readFile(new URL(`../meal-photo/fixtures/${name}`, import.meta.url))
const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

function photoForm(fields: Record<string, string | Uint8Array | null>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) continue
    if (typeof value === 'string') data.append(key, value)
    else data.append(key, new File([value as BlobPart], 'foto.jpg', { type: 'image/jpeg' }))
  }
  return data
}

function postPhoto(body: FormData, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/estimate-meal', {
    method: 'POST',
    headers: { authorization: 'Bearer token-valido', origin: 'http://localhost:5173', ...headers },
    body,
  })
}

Deno.test('foto: estima desde una foto limpia de metadatos y no guarda la foto', async () => {
  const original = await readFixture('con-gps.jpg')
  const { deps, state } = makeDeps()
  const response = await handleEstimateMeal(
    postPhoto(photoForm({ request_id: REQUEST, photo: original })),
    deps,
  )
  assertEquals(response.status, 200)
  assertEquals((await json(response)).items, ITEMS)
  assertEquals(state.calls.length, 1)
  const sent = state.calls[0]
  assert('image' in sent)
  assert(sent.image.length > 0 && sent.image.length <= original.length)
  assertFalse(latin1(sent.image).includes('Exif'), 'la foto enviada no lleva EXIF ni GPS')
  assertEquals(state.cache.size, 1)
  assert(state.logs.join('').includes('"kind":"photo"'))
})

Deno.test('foto: rechaza lo que no es una foto válida antes de consultar', async () => {
  const cases: [string, Uint8Array, number, string][] = [
    ['imagen.png', await readFixture('imagen.png'), 415, 'unsupported_type'],
    ['no-es-imagen.txt', await readFixture('no-es-imagen.txt'), 415, 'unsupported_type'],
    ['truncado.jpg', await readFixture('truncado.jpg'), 422, 'invalid_image'],
    ['grande', new Uint8Array(MAX_PHOTO_BYTES + 1), 413, 'too_large'],
  ]
  for (const [name, bytes, status, code] of cases) {
    const { deps, state } = makeDeps()
    const response = await handleEstimateMeal(
      postPhoto(photoForm({ request_id: REQUEST, photo: bytes })),
      deps,
    )
    assertEquals(response.status, status, name)
    assertEquals((await json(response)).code, code, name)
    assertEquals(state.calls.length, 0)
    assertEquals(state.minuteHits, 0)
  }
})

Deno.test('foto: falta la foto o el identificador, o el cuerpo declarado es enorme', async () => {
  const photo = await readFixture('sin-metadatos.jpg')
  for (
    const form of [
      photoForm({ request_id: REQUEST }),
      photoForm({ photo }),
      photoForm({ request_id: 'no-es-uuid', photo }),
    ]
  ) {
    const { deps } = makeDeps()
    const response = await handleEstimateMeal(postPhoto(form), deps)
    assertEquals(response.status, 400)
  }
  const { deps, state } = makeDeps()
  const huge = await handleEstimateMeal(
    postPhoto(photoForm({ request_id: REQUEST, photo }), {
      'content-length': String(MAX_PHOTO_BYTES + 1024 * 1024),
    }),
    deps,
  )
  assertEquals(huge.status, 413)
  assertEquals(state.calls.length, 0)
})

Deno.test('foto: repetir la solicitud devuelve lo guardado sin otra consulta', async () => {
  const photo = await readFixture('sin-metadatos.jpg')
  const { deps, state } = makeDeps()
  await handleEstimateMeal(postPhoto(photoForm({ request_id: REQUEST, photo })), deps)
  const again = await handleEstimateMeal(
    postPhoto(photoForm({ request_id: REQUEST, photo })),
    deps,
  )
  assertEquals((await json(again)).cached, true)
  assertEquals(state.calls.length, 1)
})

Deno.test('foto: el registro no contiene la foto ni sus bytes', async () => {
  const { deps, state } = makeDeps()
  await handleEstimateMeal(
    postPhoto(photoForm({ request_id: REQUEST, photo: await readFixture('con-gps.jpg') })),
    deps,
  )
  const all = state.logs.join('\n')
  for (const forbidden of [REQUEST, USER, 'Exif', 'Milanesa']) {
    assertFalse(all.includes(forbidden), `el registro no debe contener ${forbidden}`)
  }
})
