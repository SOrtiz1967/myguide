// Spec 009 (FR-009 a FR-012): el adaptador de Gemini con `fetch` simulado, incluidas las respuestas malformadas.
import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert'
import { AiError, type AiErrorKind, estimateMeal } from './gemini.ts'

const goodItems = { items: [{ name: 'Manzana', quantity_text: '1 unidad', energy_kcal: 95 }] }

const reply = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )

const candidate = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })

async function kindOf(run: () => Promise<unknown>): Promise<AiErrorKind> {
  const error = await assertRejects(run, AiError)
  return (error as AiError).kind
}

Deno.test('envía solo el texto, con la clave en el encabezado y el modelo configurado', async () => {
  let seen: { url: string; headers: Headers; body: string } | undefined
  const items = await estimateMeal(
    { text: '2 milanesas con puré' },
    {
      apiKey: 'clave-de-prueba',
      model: 'gemini-test',
      fetch: (url, init) => {
        seen = {
          url: String(url),
          headers: new Headers(init?.headers),
          body: String(init?.body),
        }
        return reply(candidate(JSON.stringify(goodItems)))
      },
    },
  )
  assertEquals(items[0].name, 'Manzana')
  assert(seen)
  assert(seen.url.endsWith('/models/gemini-test:generateContent'))
  assertFalse(seen.url.includes('clave-de-prueba'), 'la clave no va en la URL')
  assertEquals(seen.headers.get('x-goog-api-key'), 'clave-de-prueba')
  const body = JSON.parse(seen.body)
  assertEquals(body.contents[0].parts, [{ text: '2 milanesas con puré' }])
  assertEquals(body.generationConfig.responseMimeType, 'application/json')
})

Deno.test('con una foto envía la imagen en línea y ningún texto de la persona', async () => {
  let body: { contents: { parts: Record<string, unknown>[] }[] } | undefined
  await estimateMeal(
    { image: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
    {
      apiKey: 'k',
      fetch: (_url, init) => {
        body = JSON.parse(String(init?.body))
        return reply(candidate(JSON.stringify(goodItems)))
      },
    },
  )
  const inline = body?.contents[0].parts.find((part) => 'inlineData' in part) as
    | { inlineData: { mimeType: string; data: string } }
    | undefined
  assertEquals(inline?.inlineData.mimeType, 'image/jpeg')
  assertEquals(inline?.inlineData.data, btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0)))
})

Deno.test('429 del proveedor es cuota agotada', async () => {
  assertEquals(
    await kindOf(() => estimateMeal({ text: 'x' }, { apiKey: 'k', fetch: () => reply({}, 429) })),
    'quota',
  )
})

Deno.test('otros errores HTTP o de red son fallo del proveedor', async () => {
  for (const status of [400, 401, 403, 500, 503]) {
    assertEquals(
      await kindOf(() =>
        estimateMeal({ text: 'x' }, { apiKey: 'k', fetch: () => reply({}, status) })
      ),
      'failed',
    )
  }
  assertEquals(
    await kindOf(() =>
      estimateMeal({ text: 'x' }, {
        apiKey: 'k',
        fetch: () => Promise.reject(new TypeError('red')),
      })
    ),
    'failed',
  )
})

Deno.test('si el proveedor tarda más del límite es tiempo agotado', async () => {
  const slow: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    })
  assertEquals(
    await kindOf(() => estimateMeal({ text: 'x' }, { apiKey: 'k', fetch: slow, timeoutMs: 20 })),
    'timeout',
  )
})

Deno.test('respuestas malformadas o fuera de rango son inválidas y nunca llegan a la pantalla', async () => {
  const bad: unknown[] = [
    'esto no es JSON',
    {},
    { candidates: [] },
    { candidates: [{ content: { parts: [] } }] },
    { candidates: [{ content: { parts: [{ text: 42 }] } }] },
    candidate('no es json'),
    candidate('{"items": "nada"}'),
    candidate(JSON.stringify({ items: [{ name: 'x', energy_kcal: 80000 }] })),
    candidate(JSON.stringify({ items: [{ name: '', energy_kcal: 10 }] })),
    candidate(
      JSON.stringify({ items: Array.from({ length: 13 }, () => ({ name: 'a', energy_kcal: 1 })) }),
    ),
  ]
  for (const body of bad) {
    assertEquals(
      await kindOf(() => estimateMeal({ text: 'x' }, { apiKey: 'k', fetch: () => reply(body) })),
      'invalid',
    )
  }
})

Deno.test('una lista vacía llega como lista vacía', async () => {
  const items = await estimateMeal(
    { text: 'nada de comida' },
    { apiKey: 'k', fetch: () => reply(candidate('{"items":[]}')) },
  )
  assertEquals(items, [])
})
