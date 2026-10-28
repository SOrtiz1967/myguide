import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { es } from '../copy/es'
import { VerifyEmailBanner } from '../features/auth/VerifyEmailBanner'
import { LastRecords } from '../features/home/LastRecords'
import { useDayStatus } from '../features/meals/useDayStatus'
import { useToday } from '../features/meals/useToday'
import { isProfileComplete } from '../features/profile/profileValues'
import { useProfile } from '../features/profile/useProfile'
import { DayPanel } from '../features/week/DayPanel'
import { WeekStrip } from '../features/week/WeekStrip'
import { useOnline } from '../lib/useOnline'

/**
 * Inicio (spec 016): la semana con el estado de cada día y, al lado, el panel del día elegido. En celular el
 * panel va debajo de la semana. Los avisos de correo y de perfil incompleto se mantienen (spec 013).
 */
export function HomePage() {
  const state = (useLocation().state ?? {}) as { verificationEmailSent?: boolean }
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const online = useOnline()
  const today = useToday()
  const status = useDayStatus()
  const [anchor, setAnchor] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // El día elegido empieza siendo el que propone la regla del día (hoy, o ayer mientras se cierra).
  const day = selected ?? status.data?.proposed_date ?? today
  const shownAnchor = anchor ?? day

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="lg:col-start-1 lg:row-start-1">
            <WeekStrip
              anchor={shownAnchor}
              today={today}
              selected={day}
              onSelect={setSelected}
              onAnchorChange={(next) => {
                setAnchor(next)
                setSelected(next)
              }}
            />
          </div>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <DayPanel date={day} today={today} />
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <LastRecords />
          </div>
        </div>
      ) : (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3">
          {es.home.offline}
        </p>
      )}
    </div>
  )
}
