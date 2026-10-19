// Lectura de líneas por transmisión: solo se guarda en memoria la línea en curso.

/** Líneas de un flujo de texto. */
export async function* textLines(text: ReadableStream<string>): AsyncGenerator<string> {
  let pending = ''
  for await (const chunk of text) {
    pending += chunk
    let newline = pending.indexOf('\n')
    while (newline !== -1) {
      yield pending.slice(0, newline)
      pending = pending.slice(newline + 1)
      newline = pending.indexOf('\n')
    }
  }
  if (pending.trim() !== '') yield pending
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
