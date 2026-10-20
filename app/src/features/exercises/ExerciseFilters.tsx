import { es } from '../../copy/es'
import {
  EQUIPMENT,
  MUSCLES,
  equipmentLabel,
  isEquipment,
  isMuscle,
  muscleLabel,
  type Equipment,
  type Muscle,
} from './exerciseLists'

const selectClass = 'min-h-11 rounded-md border border-line bg-surface px-3 py-2'

interface ExerciseFiltersProps {
  muscle: Muscle | null
  equipment: Equipment | null
  onMuscle: (muscle: Muscle | null) => void
  onEquipment: (equipment: Equipment | null) => void
}

/** Filtros por músculo y por equipamiento, con una etiqueta que se quita por cada filtro activo (FR-005). */
export function ExerciseFilters({
  muscle,
  equipment,
  onMuscle,
  onEquipment,
}: ExerciseFiltersProps) {
  const t = es.exercises.filters
  const active: { key: string; label: string; remove: () => void }[] = []
  if (muscle) {
    active.push({ key: 'musculo', label: muscleLabel(muscle), remove: () => onMuscle(null) })
  }
  if (equipment) {
    active.push({
      key: 'equipo',
      label: equipmentLabel(equipment),
      remove: () => onEquipment(null),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium">
          {t.muscle}
          <select
            value={muscle ?? ''}
            onChange={(event) => onMuscle(isMuscle(event.target.value) ? event.target.value : null)}
            className={`${selectClass} font-normal`}
          >
            <option value="">{t.muscleAll}</option>
            {MUSCLES.map((code) => (
              <option key={code} value={code}>
                {muscleLabel(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-medium">
          {t.equipment}
          <select
            value={equipment ?? ''}
            onChange={(event) =>
              onEquipment(isEquipment(event.target.value) ? event.target.value : null)
            }
            className={`${selectClass} font-normal`}
          >
            <option value="">{t.equipmentAll}</option>
            {EQUIPMENT.map((code) => (
              <option key={code} value={code}>
                {equipmentLabel(code)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {active.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2" aria-label={t.active}>
          {active.map((filter) => (
            <li key={filter.key}>
              <button
                type="button"
                aria-label={t.remove(filter.label)}
                onClick={filter.remove}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3"
              >
                <span>{filter.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
