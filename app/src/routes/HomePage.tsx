import { useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { es } from '../copy/es'
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner'
import { isProfileComplete } from '../features/profile/profileValues'
import { useProfile } from '../features/profile/useProfile'
import { CaloriesBlock } from '../features/home/CaloriesBlock'
import { LastRecords } from '../features/home/LastRecords'
import { QuickLinks } from '../features/home/QuickLinks'
import { TrainingBlock } from '../features/home/TrainingBlock'
import { useOnline } from '../lib/useOnline'

export function HomePage() {
  const state = (useLocation().state ?? {}) as { verificationEmailSent?: boolean }
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const online = useOnline()

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
      {online ? (
        <>
          <CaloriesBlock />
          <TrainingBlock />
        </>
      ) : (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3">
          {es.home.offline}
        </p>
      )}
      <QuickLinks />
      {online ? <LastRecords /> : null}
    </div>
  )
}
