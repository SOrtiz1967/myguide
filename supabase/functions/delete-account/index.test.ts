// Spec 011 (FR-007 a FR-012, SC-002, SC-004, SC-005): la función `delete-account`, con Storage y Auth simulados.
import { assert, assertEquals, assertFalse } from '@std/assert'
import { BUCKETS, type DeleteDeps, handleDeleteAccount } from './handler.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const EMAIL = 'persona-secreta@ejemplo.com'
const PASSWORD = 'clave-correcta-1'

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/functions/v1/delete-account', {
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

function makeDeps(overrides: Partial<DeleteDeps> = {}) {
  const state = {
    events: [] as string[],
    removed: [] as string[],
    deleted: [] as string[],
    logs: [] as string[],
  }
  const deps: DeleteDeps = {
    authenticate: (jwt) =>
      Promise.resolve(jwt === 'token-valido' ? { id: USER, email: EMAIL } : null),
    rateLimit: () => Promise.resolve(true),
    verifyPassword: (_email, password) => {
      state.events.push('password')
      return Promise.resolve(password === PASSWORD)
    },
    removeFolder: (bucket, userId) => {
      state.events.push(`folder:${bucket}`)
      state.removed.push(`${bucket}/${userId}`)
      return Promise.resolve()
    },
    deleteUser: (userId) => {
      state.events.push('user')
      state.deleted.push(userId)
      return Promise.resolve()
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

Deno.test('con la contraseña correcta borra los archivos de ambas carpetas y después la cuenta', async () => {
  const { deps, state } = makeDeps()
  const response = await handleDeleteAccount(post({ password: PASSWORD }), deps)
  assertEquals(response.status, 200)
  assertEquals(await json(response), { deleted: true })
  assertEquals(state.events, [
    'password',
    'folder:meal-photos',
    'folder:progress-photos',
    'user',
  ])
  assertEquals(state.removed, BUCKETS.map((bucket) => `${bucket}/${USER}`))
  assertEquals(state.deleted, [USER])
})

Deno.test('con una contraseña incorrecta no se borra nada', async () => {
  const { deps, state } = makeDeps()
  const response = await handleDeleteAccount(post({ password: 'otra' }), deps)
  assertEquals(response.status, 403)
  assertEquals((await json(response)).code, 'invalid_password')
  assertEquals(state.removed.length, 0)
  assertEquals(state.deleted.length, 0)
})

Deno.test('solicitudes inválidas no llegan a comprobar la contraseña', async () => {
  for (
    const body of [{}, { password: '' }, { password: 5 }, { password: 'a'.repeat(201) }, '{x', '[]']
  ) {
    const { deps, state } = makeDeps()
    const response = await handleDeleteAccount(post(body), deps)
    assertEquals(response.status, 400)
    assertEquals(state.events.length, 0)
  }
})

Deno.test('sin token, con token inválido o con origen no permitido no se hace nada', async () => {
  const { deps, state } = makeDeps()
  for (const headers of [{ authorization: '' }, { authorization: 'Bearer otro' }]) {
    const response = await handleDeleteAccount(post({ password: PASSWORD }, headers), deps)
    assertEquals(response.status, 401)
  }
  const forbidden = await handleDeleteAccount(
    post({ password: PASSWORD }, { origin: 'https://malo.example' }),
    deps,
  )
  assertEquals(forbidden.status, 403)
  assertEquals(state.events.length, 0)
})

Deno.test('responde al preflight y rechaza otros métodos', async () => {
  const { deps } = makeDeps()
  const options = await handleDeleteAccount(
    new Request('http://localhost/x', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(options.status, 204)
  const get = await handleDeleteAccount(
    new Request('http://localhost/x', {
      method: 'GET',
      headers: { origin: 'http://localhost:5173' },
    }),
    deps,
  )
  assertEquals(get.status, 405)
})

Deno.test('el límite de intentos corta antes de comprobar la contraseña', async () => {
  const { deps, state } = makeDeps({ rateLimit: () => Promise.resolve(false) })
  const response = await handleDeleteAccount(post({ password: PASSWORD }), deps)
  assertEquals(response.status, 429)
  assertEquals((await json(response)).code, 'rate_limited')
  assertEquals(state.events.length, 0)
})

Deno.test('si falla el borrado de archivos la cuenta no se elimina', async () => {
  const { deps, state } = makeDeps({
    removeFolder: (bucket) => {
      state.events.push(`folder:${bucket}`)
      return bucket === 'progress-photos' ? Promise.reject(new Error('boom')) : Promise.resolve()
    },
  })
  const response = await handleDeleteAccount(post({ password: PASSWORD }), deps)
  assertEquals(response.status, 500)
  assertEquals((await json(response)).code, 'storage_error')
  assertEquals(state.deleted.length, 0)
})

Deno.test('si falla la eliminación de la cuenta responde delete_failed y reintentar es seguro', async () => {
  let fail = true
  const { deps, state } = makeDeps({
    deleteUser: (userId) => {
      if (fail) return Promise.reject(new Error('boom'))
      state.deleted.push(userId)
      return Promise.resolve()
    },
  })
  const first = await handleDeleteAccount(post({ password: PASSWORD }), deps)
  assertEquals(first.status, 500)
  assertEquals((await json(first)).code, 'delete_failed')
  fail = false
  const second = await handleDeleteAccount(post({ password: PASSWORD }), deps)
  assertEquals(second.status, 200)
  assertEquals(state.deleted, [USER])
})

Deno.test('los registros no contienen la persona, el correo, la contraseña ni rutas', async () => {
  const { deps, state } = makeDeps()
  await handleDeleteAccount(post({ password: PASSWORD }), deps)
  await handleDeleteAccount(post({ password: 'otra' }), deps)
  const all = state.logs.join('\n')
  assert(all.includes('delete_account'))
  for (
    const forbidden of [
      USER,
      EMAIL,
      PASSWORD,
      'otra',
      'meal-photos',
      'progress-photos',
      'token-valido',
    ]
  ) {
    assertFalse(all.includes(forbidden), `el registro no debe contener ${forbidden}`)
  }
  assert(all.includes('"result":"deleted"') && all.includes('"result":"invalid_password"'))
})
