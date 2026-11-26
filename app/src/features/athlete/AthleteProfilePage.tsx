import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { useProfile } from '../profile/useProfile'
import { ProfileSummary } from '../profile/ProfileSummary'
import { AvailabilityForm } from './AvailabilityForm'
import { GoalsForm } from './GoalsForm'
import { PreferencesForm } from './PreferencesForm'
import { currentEntry } from './athlete'
import { useAthlete } from './useAthlete'

const t = es.athlete

/** Fecha local de hoy en formato `AAAA-MM-DD` (para saber qué vigencia rige; el servidor fija la suya al guardar). */
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Perfil de atleta (spec 025): extiende el perfil de la spec 014 sin pedir de nuevo sus datos. */
export function AthleteProfilePage() {
  const athlete = useAthlete()
  const profile = useProfile()

  if (athlete.isLoading || profile.isLoading) return <LoadingState label={t.loading} />
  if (athlete.isError || !athlete.data || profile.isError || !profile.data) {
    return (
      <ErrorState
        message={t.loadError}
        onRetry={() => {
          void athlete.refetch()
          void profile.refetch()
        }}
      />
    )
  }

  const data = athlete.data
  const today = localToday()
  const goals = currentEntry(data.goals, today)
  const availability = currentEntry(data.availability, today)

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{t.title}</h1>
      <p className="text-muted">{t.intro}</p>

      <section aria-label={t.fromProfile.title} className="flex flex-col gap-2">
        <h2 className="text-base font-bold">{t.fromProfile.title}</h2>
        <p className="text-sm text-muted">{t.fromProfile.hint}</p>
        <ProfileSummary profile={profile.data} />
        <Link to="/perfil" className="inline-flex min-h-11 items-center underline">
          {t.fromProfile.edit}
        </Link>
      </section>

      {/* Se vuelven a montar al cambiar lo guardado, así cada formulario muestra lo confirmado. */}
      <GoalsForm
        key={`goals-${goals?.created_at ?? 'none'}`}
        current={goals}
        history={data.goals}
      />
      <AvailabilityForm
        key={`availability-${availability?.created_at ?? 'none'}`}
        current={availability}
        history={data.availability}
      />
      <PreferencesForm
        key={`prefs-${data.preferences ? JSON.stringify(data.preferences) : 'none'}-${data.items.length}`}
        preferences={data.preferences}
        items={data.items}
      />
    </div>
  )
}
