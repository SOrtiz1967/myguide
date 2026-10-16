import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { detectDeviceTimezone, isValidTimezone } from '../../lib/timezone'
import { ChangePasswordForm } from '../auth/ChangePasswordForm'
import { ProfileForm } from './ProfileForm'
import { toProfileUpdate } from './profileValues'
import { ProfileSummary } from './ProfileSummary'
import { TimezoneNotice } from './TimezoneNotice'
import { useProfile } from './useProfile'
import { useUpdateProfile } from './useUpdateProfile'

export function ProfilePage() {
  const { data: profile, isLoading, isError, refetch } = useProfile()
  const update = useUpdateProfile()

  if (isLoading) return <LoadingState label={es.profile.loading} />
  if (isError || !profile) {
    return <ErrorState message={es.profile.loadError} onRetry={() => void refetch()} />
  }

  const device = detectDeviceTimezone()
  const showTimezoneNotice = isValidTimezone(device) && device !== profile.timezone

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{es.profile.title}</h1>

      <ProfileSummary profile={profile} />

      {showTimezoneNotice ? (
        <TimezoneNotice
          deviceTimezone={device}
          savedTimezone={profile.timezone}
          busy={update.isPending}
          onAccept={(timezone) => update.mutate({ ...toProfileUpdate(profile), timezone })}
        />
      ) : null}

      {/* Se vuelve a montar al cambiar el perfil guardado, así el formulario muestra lo confirmado. */}
      <ProfileForm key={profile.updated_at} profile={profile} />

      <section aria-labelledby="cambiar-contrasena" className="flex flex-col gap-4">
        <h2 id="cambiar-contrasena" className="text-lg font-semibold">
          {es.auth.actions.changePassword}
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  )
}
