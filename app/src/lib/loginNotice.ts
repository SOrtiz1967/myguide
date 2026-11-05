// Un aviso para la pantalla de ingreso que sobrevive a las redirecciones de las guardas de rutas.
// Al cerrar la sesión, `RequireAuth` redirige a /ingresar por su cuenta y pisa el estado de la navegación; por eso
// el aviso viaja en el almacenamiento de la sesión del navegador. Si no se puede leer o escribir, simplemente no hay aviso.

export type LoginNotice = 'accountDeleted'

const KEY = 'myguide:login-notice'

export function setLoginNotice(notice: LoginNotice): void {
  try {
    sessionStorage.setItem(KEY, notice)
  } catch {
    // Sin almacenamiento no hay aviso: no es un error.
  }
}

/** El aviso guardado, sin borrarlo (el borrado va aparte para que React pueda volver a leerlo). */
export function peekLoginNotice(): LoginNotice | null {
  try {
    return sessionStorage.getItem(KEY) === 'accountDeleted' ? 'accountDeleted' : null
  } catch {
    return null
  }
}

export function clearLoginNotice(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nada que borrar.
  }
}
