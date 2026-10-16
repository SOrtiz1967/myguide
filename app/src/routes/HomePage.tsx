import { useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { es } from '../copy/es'
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner'
import { isProfileComplete } from '../features/profile/profileValues'
import { useProfile } from '../features/profile/useProfile'

export function HomePage() {
  const state = (useLocation().state ?? {}) as { verificationEmailSent?: boolean }
  const navigate = useNavigate()
  const { data: profile } = useProfile()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.home.title}</h1>
      {state.verificationEmailSent === false ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
          {es.auth.verifyEmailNotSent}
        </p>
      ) : null}
      <VerifyEmailBanner />
      {profile && !isProfileComplete(profile) ? (
        <EmptyState
          title={es.profile.emptyTitle}
          description={es.profile.emptyBody}
          actionLabel={es.profile.emptyAction}
          onAction={() => void navigate('/perfil')}
        />
      ) : null}
    </div>
  )
}
