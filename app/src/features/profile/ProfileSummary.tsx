import { es } from '../../copy/es'
import { formatDate, formatHeight } from '../../lib/format'
import type { Profile } from './api'

/** Datos guardados. Lo no informado se muestra como "No informado", nunca con un valor supuesto (FR-017). */
export function ProfileSummary({ profile }: { profile: Profile }) {
  const sex = profile.sex ? es.profile.sexOptions[profile.sex] : null
  const rows: Array<[string, string | null]> = [
    [es.profile.labels.birthDate, profile.birth_date ? formatDate(profile.birth_date) : null],
    [es.profile.labels.sex, sex],
    [es.profile.labels.height, profile.height_cm === null ? null : formatHeight(profile.height_cm)],
    [es.profile.labels.timezone, profile.timezone],
  ]

  return (
    <section
      aria-label={es.profile.summaryTitle}
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-lg font-semibold">{es.profile.summaryTitle}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label.replace(' (cm)', '')}</dt>
            <dd>{value ?? es.profile.notInformed}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
