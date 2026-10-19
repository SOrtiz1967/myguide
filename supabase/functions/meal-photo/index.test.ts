// T057 (spec 003, FR-030 a FR-035): la función `meal-photo`, con Storage y la base simulados.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { handleMealPhoto, MAX_PHOTO_BYTES, type PhotoDeps, type PhotoRow } from './handler.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const read = (name: string) => Deno.readFile(new URL(`./fixtures/${name}`, import.meta.url))
const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

function form(fields: Record<string, string | Uint8Array | null>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) continue
    if (typeof value === 'string') data.append(key, value)
    else data.append(key, new File([value as BlobPart], 'foto.jpg', { type: 'image/jpeg' }))
  }
  return data
}

function post(body: FormData, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/meal-photo', {
    method: 'POST',
    headers: { authorization: 'Bearer token-valido', origin: 'http://localhost:5173', ...headers },
    body,
  })
}

function del(query: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/functions/v1/meal-photo?${query}`, {
    method: 'DELETE',
    headers: { authorization: 'Bearer token-valido', origin: 'http://localhost:5173', ...headers },
  })
}

function makeDeps(overrides: Partial<PhotoDeps> = {}) {
  const state = {
    objects: new Map<string, Uint8Array>(),
    rows: new Map<string, PhotoRow & { id: string }>(),
    removed: [] as string[],
    logs: [] as string[],
    saves: 0,
  }
  let counter = 0
  const key = (user: string, date: string, meal: string) => `${user}|${date}|${meal}`
  const deps: PhotoDeps = {
    authenticate: (jwt) => Promise.resolve(jwt === 'token-valido' ? USER : null),
    rateLimit: () => Promise.resolve(true),
    store: {
      upload: (path, bytes) => {
        state.objects.set(path, bytes)
        return Promise.resolve()
      },
      remove: (path) => {
        state.removed.push(path)
        state.objects.delete(path)
        return Promise.resolve()
      },
    },
    records: {
      find: (user, date, meal) => {
        const row = state.rows.get(key(user, date, meal))
        return Promise.resolve(row ? { id: row.id, storage_path: row.storage_path } : null)
      },
      save: (row) => {
        state.saves++
        const previous = state.rows.get(key(row.user_id, row.log_date, row.meal))
        const id = previous?.id ?? `foto-${++counter}`
        state.rows.set(key(row.user_id, row.log_date, row.meal), { ...row, id })
        return Promise.resolve({ id })
      },
      remove: (user, date, meal) => {
        state.rows.delete(key(user, date, meal))
        return Promise.resolve()
      },
    },
    newId: () => crypto.randomUUID(),
    now: () => new Date('2026-10-19T12:00:00Z'),
    log: (level, event, fields) => {
      state.logs.push(JSON.stringify({ level, event, ...fields }))
    },
    ...overrides,
  }
  return { deps, state }
}

const valid = async () =>
  form({ log_date: '2026-10-19', meal: 'lunch', photo: await read('con-gps.jpg') })

Deno.test('guarda en <user_id>/<uuid>.jpg el archivo LIMPIO y responde sin ruta ni persona', async () => {
  const { deps, state } = makeDeps()
  const res = await handleMealPhoto(post(await valid()), deps)
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(Object.keys(body).sort(), ['bytes', 'height', 'id', 'log_date', 'meal', 'width'])
  assertEquals(body.width, 800)
  assertEquals(body.log_date, '2026-10-19')

  const [path] = [...state.objects.keys()]
  assert(new RegExp(`^${USER}/[0-9a-f-]{36}\\.jpg$`).test(path!))
  const stored = state.objects.get(path!)!
  assertFalse(text(stored).includes('Exif'))
  assertFalse(text(stored).includes('MarcaDePruebaCamara'))
  assertFalse(text(stored).includes('comentario-privado-de-prueba'))
  assertEquals(body.bytes, stored.length)
})

Deno.test('401: sin sesión, con un token inválido o con la sesión vencida', async () => {
  const { deps } = makeDeps()
  const noHeader = new Request('http://localhost/functions/v1/meal-photo', {
    method: 'POST',
    body: await valid(),
  })
  assertEquals((await handleMealPhoto(noHeader, deps)).status, 401)
  const bad = post(await valid(), { authorization: 'Bearer otro' })
  assertEquals((await handleMealPhoto(bad, deps)).status, 401)
  const expired = makeDeps({ authenticate: () => Promise.resolve(null) })
  assertEquals((await handleMealPhoto(post(await valid()), expired.deps)).status, 401)
  assertEquals(expired.state.objects.size, 0)
})

Deno.test('un origen no permitido se rechaza antes de hacer nada', async () => {
  const { deps, state } = makeDeps()
  const res = await handleMealPhoto(post(await valid(), { origin: 'https://malo.example' }), deps)
  assertEquals(res.status, 403)
  assertEquals(state.objects.size, 0)
})

Deno.test('el preflight responde 204 con CORS', async () => {
  const { deps } = makeDeps()
  const res = await handleMealPhoto(
    new Request('http://localhost/functions/v1/meal-photo', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(res.status, 204)
  assert(res.headers.get('access-control-allow-methods')!.includes('DELETE'))
})

Deno.test('400: log_date o meal inválidos, o sin foto', async () => {
  const { deps, state } = makeDeps()
  const photo = await read('con-gps.jpg')
  for (
    const fields of [
      { log_date: '2026-13-40', meal: 'lunch', photo },
      { log_date: '1999-12-31', meal: 'lunch', photo },
      { log_date: '2026-12-31', meal: 'lunch', photo },
      { log_date: 'ayer', meal: 'lunch', photo },
      { log_date: '2026-10-19', meal: 'brunch', photo },
      { log_date: '2026-10-19', meal: null, photo },
      { log_date: '2026-10-19', meal: 'lunch', photo: null },
    ]
  ) {
    assertEquals((await handleMealPhoto(post(form(fields)), deps)).status, 400)
  }
  assertEquals(state.objects.size, 0)
})

Deno.test('413: más de 3 MB', async () => {
  const { deps, state } = makeDeps()
  const big = new Uint8Array(MAX_PHOTO_BYTES + 1)
  big.set([0xff, 0xd8, 0xff])
  const res = await handleMealPhoto(
    post(form({ log_date: '2026-10-19', meal: 'lunch', photo: big })),
    deps,
  )
  assertEquals(res.status, 413)
  assertEquals(state.objects.size, 0)
})

Deno.test('413: el tamaño declarado del cuerpo ya supera el límite', async () => {
  const { deps } = makeDeps()
  const res = await handleMealPhoto(
    post(await valid(), { 'content-length': String(MAX_PHOTO_BYTES * 4) }),
    deps,
  )
  assertEquals(res.status, 413)
})

Deno.test('415: lo que no es JPEG', async () => {
  const { deps, state } = makeDeps()
  for (const name of ['imagen.png', 'no-es-imagen.txt']) {
    const res = await handleMealPhoto(
      post(form({ log_date: '2026-10-19', meal: 'lunch', photo: await read(name) })),
      deps,
    )
    assertEquals(res.status, 415, name)
  }
  assertEquals(state.objects.size, 0)
})

Deno.test('422: un JPEG corrupto', async () => {
  const { deps, state } = makeDeps()
  const res = await handleMealPhoto(
    post(form({ log_date: '2026-10-19', meal: 'lunch', photo: await read('truncado.jpg') })),
    deps,
  )
  assertEquals(res.status, 422)
  assertEquals((await res.json()).code, 'invalid_image')
  assertEquals(state.objects.size, 0)
})

Deno.test('429: más de 30 fotos por hora por cuenta', async () => {
  let keyUsed = ''
  const { deps, state } = makeDeps({
    rateLimit: (key) => {
      keyUsed = key
      return Promise.resolve(false)
    },
  })
  const res = await handleMealPhoto(post(await valid()), deps)
  assertEquals(res.status, 429)
  assertEquals(keyUsed, `meal-photo:${USER}`)
  assertEquals(state.objects.size, 0)
})

Deno.test('reemplazar borra la foto anterior y deja una sola', async () => {
  const { deps, state } = makeDeps()
  await handleMealPhoto(post(await valid()), deps)
  const [first] = [...state.objects.keys()]
  const res = await handleMealPhoto(post(await valid()), deps)
  assertEquals(res.status, 200)
  assertEquals(state.objects.size, 1)
  assertEquals(state.removed, [first])
  assertFalse(state.objects.has(first!))
  assertEquals(state.rows.size, 1)
})

Deno.test('si la fila no se pudo guardar, borra el objeto huérfano', async () => {
  const { deps, state } = makeDeps()
  deps.records.save = () => Promise.reject(new Error('base caída'))
  const res = await handleMealPhoto(post(await valid()), deps)
  assertEquals(res.status, 500)
  assertEquals(state.objects.size, 0)
  assertEquals(state.removed.length, 1)
  assertEquals((await res.json()).code, 'storage_error')
})

Deno.test('si el almacenamiento falla responde 500 con un mensaje genérico', async () => {
  const { deps, state } = makeDeps()
  deps.store.upload = () => Promise.reject(new Error('secreto interno: bucket x'))
  const res = await handleMealPhoto(post(await valid()), deps)
  assertEquals(res.status, 500)
  const body = JSON.stringify(await res.json())
  assertFalse(body.includes('secreto'))
  assertEquals(state.rows.size, 0)
})

Deno.test('DELETE borra el objeto y la fila, y es idempotente', async () => {
  const { deps, state } = makeDeps()
  await handleMealPhoto(post(await valid()), deps)
  assertEquals(state.objects.size, 1)

  const first = await handleMealPhoto(del('log_date=2026-10-19&meal=lunch'), deps)
  assertEquals(first.status, 204)
  assertEquals(state.objects.size, 0)
  assertEquals(state.rows.size, 0)

  const again = await handleMealPhoto(del('log_date=2026-10-19&meal=lunch'), deps)
  assertEquals(again.status, 204)
})

Deno.test('DELETE exige sesión y parámetros válidos', async () => {
  const { deps } = makeDeps()
  assertEquals(
    (await handleMealPhoto(
      del('log_date=2026-10-19&meal=lunch', { authorization: 'Bearer x' }),
      deps,
    ))
      .status,
    401,
  )
  assertEquals((await handleMealPhoto(del('log_date=hoy&meal=lunch'), deps)).status, 400)
  assertEquals((await handleMealPhoto(del('log_date=2026-10-19&meal=otra'), deps)).status, 400)
})

Deno.test('otros métodos dan 405', async () => {
  const { deps } = makeDeps()
  const res = await handleMealPhoto(
    new Request('http://localhost/functions/v1/meal-photo', { method: 'GET' }),
    deps,
  )
  assertEquals(res.status, 405)
})

Deno.test('Principio IX: el registro no contiene persona, ruta, fecha ni comida', async () => {
  const { deps, state } = makeDeps()
  await handleMealPhoto(post(await valid()), deps)
  await handleMealPhoto(del('log_date=2026-10-19&meal=lunch'), deps)
  assert(state.logs.length >= 2)
  const all = state.logs.join('\n')
  assertFalse(all.includes(USER))
  assertFalse(all.includes('2026-10-19'))
  assertFalse(all.includes('lunch'))
  assertFalse(all.includes('.jpg'))
  assertFalse(all.includes('token-valido'))
  assert(all.includes('request_id'))
  assert(all.includes('bytes_in'))
})
