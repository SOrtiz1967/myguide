import { es } from '../../copy/es'
import { ChangePasswordForm } from '../auth/ChangePasswordForm'

// Provisional: la historia 3 agrega el formulario del perfil (fecha de nacimiento, altura, zona horaria).
export function ProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <section aria-labelledby="cambiar-contrasena" className="flex flex-col gap-4">
        <h2 id="cambiar-contrasena" className="text-lg font-semibold">
          {es.auth.actions.changePassword}
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  )
}
