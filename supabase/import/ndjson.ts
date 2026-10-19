// Lectura de líneas por transmisión: solo se guarda en memoria la línea en curso.

/** Una línea más larga que esto es un dato corrupto: se descarta sin acumularla en memoria. */
export const DEFAULT_MAX_LINE_LENGTH = 5_000_000

export interface LineOptions {
  maxLineLength?: number
  /** Se llama una vez por cada línea desmedida descartada. */
  onOverflow?: () => void
}

/** Líneas de un flujo de texto. Solo se guarda en memoria la línea en curso (con un tope de longitud). */
export async function* textLines(
  text: ReadableStream<string>,
  { maxLineLength = DEFAULT_MAX_LINE_LENGTH, onOverflow }: LineOptions = {},
): AsyncGenerator<string> {
  let pending = ''
  let skipping = false
  for await (const chunk of text) {
    let data = chunk
    if (skipping) {
      const end = data.indexOf('\n')
      if (end === -1) continue
      data = data.slice(end + 1)
      skipping = false
    }
    pending += data
    let newline = pending.indexOf('\n')
    while (newline !== -1) {
      const line = pending.slice(0, newline)
      pending = pending.slice(newline + 1)
      if (line.length > maxLineLength) onOverflow?.()
      else yield line
      newline = pending.indexOf('\n')
    }
    if (pending.length > maxLineLength) {
      pending = ''
      skipping = true
      onOverflow?.()
    }
  }
  if (!skipping && pending.trim() !== '') yield pending
}

/** Objetos de un archivo NDJSON (una línea, un objeto). Una línea que no es JSON se informa y se ignora. */
export async function* readNdjson<T>(
  path: string,
  onMalformed?: (line: number) => void,
): AsyncGenerator<T> {
  const file = await Deno.open(path)
  const text = file.readable.pipeThrough(new TextDecoderStream())
  let number = 0
  for await (const line of textLines(text)) {
    number++
    if (line.trim() === '') continue
    try {
      yield JSON.parse(line) as T
    } catch {
      onMalformed?.(number)
    }
  }
}
