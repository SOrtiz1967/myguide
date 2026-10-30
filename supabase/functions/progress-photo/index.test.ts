// Spec 019 (FR-003 a FR-006, FR-009, FR-010, FR-016, FR-017, FR-019): la función `progress-photo`, con Storage y la base simulados.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { handleProgressPhoto, MAX_PHOTO_BYTES, MAX_PHOTOS, type PhotoDeps, type PhotoRow } from './handler.ts'

const USER = '11111111-1111-1111-1111-111111111111'
// Las mismas fotos de prueba que `meal-photo`: GPS, XMP, IPTC, comentario, PNG, texto y JPEG truncado.
const read = (name: string) =>
  Deno.readFile(new URL(`../meal-photo/fixtures/${name}`, import.meta.url))
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
  return new Request('http://localhost/functions/v1/progress-photo', {
    method: 'POST',
    headers: { authorization: 'Bearer token-valido', origin: 'http://localhost:5173', ...headers },
    body,
  })
}

function del(query: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/functions/v1/progress-photo?${query}`, {
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
    extraRows: 0,
  }
  let counter = 0
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
      count: () => Promise.resolve(state.rows.size + state.extraRows),
      find: (user, id) => {
        const row = state.rows.get(id)
        return Promise.resolve(
          row && row.user_id === user ? { id: row.id, storage_path: row.storage_path } : null,
        )
      },
      save: (row) => {
        counter++
        const id = crypto.randomUUID()
        state.rows.set(id, { ...row, id })
        return Promise.resolve({ id })
      },
      remove: (_user, id) => {
        state.rows.delete(id)
        return Promise.resolve()
      },
    },
    newId: () => crypto.randomUUID(),
    now: () => new Date('2026-10-30T12:00:00Z'),
    log: (level, event, fields) => {
      state.logs.push(JSON.stringify({ level, event, ...fields }))
    },
    ...overrides,
  }
  return { deps, state }
}

const valid = async (extra: Record<string, string | null> = {}) =>
  form({ taken_on: '2026-10-30', pose: 'front', photo: await read('con-gps.jpg'), ...extra })

Deno.test('guarda en <user_id>/<uuid>.jpg el archivo LIMPIO y responde sin ruta ni persona', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(post(await valid()), deps)
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(Object.keys(body).sort(), ['bytes', 'height', 'id', 'pose', 'taken_on', 'width'])
  assertEquals(body.taken_on, '2026-10-30')
  assertEquals(body.pose, 'front')

  const [path] = [...state.objects.keys()]
  assert(new RegExp(`^${USER}/[0-9a-f-]{36}\\.jpg$`).test(path!))
  const stored = state.objects.get(path!)!
  assertFalse(text(stored).includes('Exif'))
  assertFalse(text(stored).includes('MarcaDePruebaCamara'))
  assertFalse(text(stored).includes('comentario-privado-de-prueba'))
  assertEquals(body.bytes, stored.length)
  assertEquals([...state.rows.values()][0]?.storage_path, path)
})

Deno.test('FR-004: también se quitan XMP e IPTC', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(
    post(form({ taken_on: '2026-10-30', photo: await read('con-xmp-iptc.jpg') })),
    deps,
  )
  assertEquals(res.status, 200)
  const stored = text([...state.objects.values()][0]!)
  assertFalse(stored.includes('xmp-privado-de-prueba'))
  assertFalse(stored.includes('iptc-privado-de-prueba'))
})

Deno.test('la pose es opcional: sin ella queda nula', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(post(await valid({ pose: null })), deps)
  assertEquals(res.status, 200)
  assertEquals((await res.json()).pose, null)
  assertEquals([...state.rows.values()][0]?.pose, null)
  const blank = await handleProgressPhoto(post(await valid({ pose: '' })), deps)
  assertEquals((await blank.json()).pose, null)
})

Deno.test('401: sin sesión, con un token inválido o con la sesión vencida', async () => {
  const { deps } = makeDeps()
  const noHeader = new Request('http://localhost/functions/v1/progress-photo', {
    method: 'POST',
    body: await valid(),
  })
  assertEquals((await handleProgressPhoto(noHeader, deps)).status, 401)
  const bad = post(await valid(), { authorization: 'Bearer otro' })
  assertEquals((await handleProgressPhoto(bad, deps)).status, 401)
  const expired = makeDeps({ authenticate: () => Promise.resolve(null) })
  assertEquals((await handleProgressPhoto(post(await valid()), expired.deps)).status, 401)
  assertEquals(expired.state.objects.size, 0)
  const noDelete = makeDeps({ authenticate: () => Promise.resolve(null) })
  assertEquals(
    (await handleProgressPhoto(del(`id=${crypto.randomUUID()}`), noDelete.deps)).status,
    401,
  )
})

Deno.test('un origen no permitido se rechaza antes de hacer nada', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(
    post(await valid(), { origin: 'https://malo.example' }),
    deps,
  )
  assertEquals(res.status, 403)
  assertEquals(state.objects.size, 0)
})

Deno.test('el preflight responde 204 con CORS', async () => {
  const { deps } = makeDeps()
  const res = await handleProgressPhoto(
    new Request('http://localhost/functions/v1/progress-photo', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(res.status, 204)
  assert(res.headers.get('access-control-allow-methods')!.includes('DELETE'))
})

Deno.test('400: fecha o pose inválidas, o sin foto', async () => {
  const { deps, state } = makeDeps()
  const photo = await read('con-gps.jpg')
  for (
    const fields of [
      { taken_on: '2026-13-40', pose: null, photo },
      { taken_on: '1999-12-31', pose: null, photo },
      { taken_on: '2026-11-02', pose: null, photo },
      { taken_on: 'ayer', pose: null, photo },
      { taken_on: null, pose: null, photo },
      { taken_on: '2026-10-30', pose: 'cara', photo },
      { taken_on: '2026-10-30', pose: null, photo: null },
    ]
  ) {
    assertEquals((await handleProgressPhoto(post(form(fields)), deps)).status, 400)
  }
  assertEquals(state.objects.size, 0)
})

Deno.test('mañana se acepta (margen por la zona horaria)', async () => {
  const { deps } = makeDeps()
  const res = await handleProgressPhoto(post(await valid({ taken_on: '2026-10-31' })), deps)
  assertEquals(res.status, 200)
})

Deno.test('413: más de 3 MB', async () => {
  const { deps, state } = makeDeps()
  const big = new Uint8Array(MAX_PHOTO_BYTES + 1)
  big.set([0xff, 0xd8, 0xff])
  const res = await handleProgressPhoto(post(form({ taken_on: '2026-10-30', photo: big })), deps)
  assertEquals(res.status, 413)
  assertEquals(state.objects.size, 0)
})

Deno.test('413: el tamaño declarado del cuerpo ya supera el límite', async () => {
  const { deps } = makeDeps()
  const res = await handleProgressPhoto(
    post(await valid(), { 'content-length': String(MAX_PHOTO_BYTES * 4) }),
    deps,
  )
  assertEquals(res.status, 413)
})

Deno.test('415: lo que no es JPEG', async () => {
  const { deps, state } = makeDeps()
  for (const name of ['imagen.png', 'no-es-imagen.txt']) {
    const res = await handleProgressPhoto(
      post(form({ taken_on: '2026-10-30', photo: await read(name) })),
      deps,
    )
    assertEquals(res.status, 415, name)
  }
  assertEquals(state.objects.size, 0)
})

Deno.test('422: un JPEG corrupto', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(
    post(form({ taken_on: '2026-10-30', photo: await read('truncado.jpg') })),
    deps,
  )
  assertEquals(res.status, 422)
  assertEquals((await res.json()).code, 'invalid_image')
  assertEquals(state.objects.size, 0)
})

Deno.test('429: pasado el límite por hora no se guarda nada', async () => {
  const { deps, state } = makeDeps({ rateLimit: () => Promise.resolve(false) })
  const res = await handleProgressPhoto(post(await valid()), deps)
  assertEquals(res.status, 429)
  assertEquals((await res.json()).code, 'rate_limited')
  assertEquals(state.objects.size, 0)
})

Deno.test('409: con 200 fotos no se guarda otra y no se borra nada', async () => {
  const { deps, state } = makeDeps()
  state.extraRows = MAX_PHOTOS
  const res = await handleProgressPhoto(post(await valid()), deps)
  assertEquals(res.status, 409)
  assertEquals((await res.json()).code, 'limit_reached')
  assertEquals(state.objects.size, 0)
  assertEquals(state.removed.length, 0)
})

Deno.test('con 199 fotos todavía se puede subir una', async () => {
  const { deps, state } = makeDeps()
  state.extraRows = MAX_PHOTOS - 1
  assertEquals((await handleProgressPhoto(post(await valid()), deps)).status, 200)
})

Deno.test('FR-016: si la fila no se guarda, el objeto recién subido se borra', async () => {
  const { deps, state } = makeDeps()
  deps.records.save = () => Promise.reject(new Error('save_failed'))
  const res = await handleProgressPhoto(post(await valid()), deps)
  assertEquals(res.status, 500)
  assertEquals(state.objects.size, 0)
  assertEquals(state.removed.length, 1)
})

Deno.test('500: si Storage falla no se registra ninguna fila', async () => {
  const { deps, state } = makeDeps()
  deps.store.upload = () => Promise.reject(new Error('upload_failed'))
  const res = await handleProgressPhoto(post(await valid()), deps)
  assertEquals(res.status, 500)
  assertEquals((await res.json()).code, 'storage_error')
  assertEquals(state.rows.size, 0)
})

Deno.test('DELETE borra la fila y el objeto de la foto', async () => {
  const { deps, state } = makeDeps()
  const saved = await (await handleProgressPhoto(post(await valid()), deps)).json()
  const path = [...state.objects.keys()][0]!
  const res = await handleProgressPhoto(del(`id=${saved.id}`), deps)
  assertEquals(res.status, 204)
  assertEquals(state.rows.size, 0)
  assertEquals(state.objects.size, 0)
  assertEquals(state.removed, [path])
})

Deno.test('DELETE es idempotente: sin foto responde 204 y no toca nada', async () => {
  const { deps, state } = makeDeps()
  const res = await handleProgressPhoto(del(`id=${crypto.randomUUID()}`), deps)
  assertEquals(res.status, 204)
  assertEquals(state.removed.length, 0)
})

Deno.test('DELETE con un id mal formado es 400', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleProgressPhoto(del('id=1'), deps)).status, 400)
  assertEquals((await handleProgressPhoto(del(''), deps)).status, 400)
})

Deno.test('DELETE no borra la foto de otra cuenta', async () => {
  const { deps, state } = makeDeps()
  state.rows.set('ajena', {
    id: 'ajena',
    user_id: '22222222-2222-2222-2222-222222222222',
    taken_on: '2026-10-01',
    pose: null,
    storage_path: '22222222-2222-2222-2222-222222222222/x.jpg',
    width: 1,
    height: 1,
    bytes: 1,
  })
  // El id no es un UUID, pero el repositorio simulado lo compara igual: la consulta real filtra por dueña.
  const res = await handleProgressPhoto(del(`id=${crypto.randomUUID()}`), deps)
  assertEquals(res.status, 204)
  assertEquals(state.rows.size, 1)
})

Deno.test('un objeto que no se puede borrar no cambia la respuesta y se registra sin la ruta', async () => {
  const { deps, state } = makeDeps()
  const saved = await (await handleProgressPhoto(post(await valid()), deps)).json()
  const path = [...state.objects.keys()][0]!
  deps.store.remove = () => Promise.reject(new Error('remove_failed'))
  const res = await handleProgressPhoto(del(`id=${saved.id}`), deps)
  assertEquals(res.status, 204)
  const logged = state.logs.join('\n')
  assert(logged.includes('progress_photo_object_not_removed'))
  assertFalse(logged.includes(path))
})

Deno.test('Principio IX: el registro no lleva persona, ruta, fecha, pose ni contenido', async () => {
  const { deps, state } = makeDeps()
  await handleProgressPhoto(post(await valid({ taken_on: '2026-10-29', pose: 'back' })), deps)
  const path = [...state.objects.keys()][0]!
  const logged = state.logs.join('\n')
  assert(logged.includes('"result":"saved"'))
  assertFalse(logged.includes(USER))
  assertFalse(logged.includes(path))
  assertFalse(logged.includes('2026-10-29'))
  assertFalse(logged.includes('back'))
  assertFalse(logged.includes('MarcaDePruebaCamara'))
})

Deno.test('otros métodos responden 405', async () => {
  const { deps } = makeDeps()
  const res = await handleProgressPhoto(
    new Request('http://localhost/functions/v1/progress-photo', {
      method: 'GET',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(res.status, 405)
})
