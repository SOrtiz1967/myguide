import { useLocation } from 'react-router'
import { es } from '../copy/es'
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner'

export function HomePage() {
  const state = (useLocation().state ?? {}) as { verificationEmailSent?: boolean }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
      {state.verificationEmailSent === false ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {es.auth.verifyEmailNotSent}
        </p>
      ) : null}
      <VerifyEmailBanner />
    </div>
  )
}
