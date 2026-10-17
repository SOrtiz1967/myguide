import { es } from '../../copy/es'

interface TimezoneNoticeProps {
  deviceTimezone: string
  savedTimezone: string | null
  busy: boolean
  onAccept: (timezone: string) => void
}

/**
 * Propone la zona horaria del dispositivo cuando difiere de la guardada. Nunca la aplica sola:
 * cambiarla es una decisión de la persona (FR-016).
 */
export function TimezoneNotice({
  deviceTimezone,
  savedTimezone,
  busy,
  onAccept,
}: TimezoneNoticeProps) {
  return (
    <section
      aria-label={es.profile.timezoneNoticeTitle}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <p>
        {es.profile.deviceTimezoneIs(deviceTimezone)}{' '}
        {savedTimezone ? es.profile.timezoneNoticeDifferent : es.profile.timezoneNoticeSame}
      </p>
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => onAccept(deviceTimezone)}
        >
          {es.profile.useDeviceTimezone(deviceTimezone)}
        </button>
      </div>
    </section>
  )
}
