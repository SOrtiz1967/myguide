/** Entrega un archivo armado en el navegador como descarga. Nada pasa por el servidor. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Se libera en el próximo ciclo para que la descarga alcance a empezar.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
