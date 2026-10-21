import { z } from 'zod'
import { es } from '../../copy/es'
import { isEquipment, isMeasurementType, isMuscle } from './exerciseLists'
import type { Equipment, MeasurementType, Muscle } from './exerciseLists'

// Las mismas reglas que create_exercise / update_exercise en la base de datos (FR-025), para que la
// persona vea el error al escribir y no recién al guardar. La base las vuelve a imponer.

export const MAX_NAME = 120
export const MAX_DESCRIPTION = 4000
export const MAX_ALIAS = 80
/** El formulario ofrece hasta 5 «otros nombres»; la base admite 10 (los importados pueden traer más). */
export const MAX_FORM_ALIASES = 5
export const MAX_PRIMARY = 5
export const MAX_SECONDARY = 10

const e = es.exercises.errors

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** «Otros nombres»: uno por línea o separados por coma; sin vacíos ni repetidos (sin importar acentos). */
export function parseAliases(text: string): string[] {
  const seen = new Set<string>()
  const aliases: string[] = []
  for (const part of text.split(/[\n,]/)) {
    const alias = part.trim()
    if (alias === '') continue
    const key = normalize(alias)
    if (seen.has(key)) continue
    seen.add(key)
    aliases.push(alias)
  }
  return aliases
}

/** Lo que escribe la persona: los músculos como listas de códigos y los otros nombres como texto. */
export const exerciseFormSchema = z
  .object({
    name: z.string(),
    measurement_type: z.string(),
    primary_muscles: z.array(z.string()),
    secondary_muscles: z.array(z.string()),
    equipment: z.string(),
    description: z.string(),
    aliases: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    const name = values.name.trim()
    if (name === '') issue('name', e.nameRequired)
    else if (name.length > MAX_NAME) issue('name', e.nameTooLong)

    if (!isMeasurementType(values.measurement_type))
      issue('measurement_type', e.measurementRequired)

    if (!values.primary_muscles.every(isMuscle)) issue('primary_muscles', e.saveFailed)
    else if (values.primary_muscles.length > MAX_PRIMARY) issue('primary_muscles', e.tooManyPrimary)
    if (!values.secondary_muscles.every(isMuscle)) issue('secondary_muscles', e.saveFailed)
    else if (values.secondary_muscles.length > MAX_SECONDARY) {
      issue('secondary_muscles', e.tooManySecondary)
    } else if (values.secondary_muscles.some((m) => values.primary_muscles.includes(m))) {
      issue('secondary_muscles', e.muscleRepeated)
    }

    if (values.equipment !== '' && !isEquipment(values.equipment)) issue('equipment', e.saveFailed)
    if (values.description.trim().length > MAX_DESCRIPTION)
      issue('description', e.descriptionTooLong)

    const aliases = parseAliases(values.aliases).filter(
      (alias) => normalize(alias) !== normalize(name),
    )
    if (aliases.some((alias) => alias.length > MAX_ALIAS)) issue('aliases', e.aliasTooLong)
    else if (aliases.length > MAX_FORM_ALIASES) issue('aliases', e.tooManyAliases)
  })
  .transform((values): ExercisePayload => {
    const name = values.name.trim()
    return {
      name,
      measurement_type: values.measurement_type as MeasurementType,
      primary_muscles: values.primary_muscles as Muscle[],
      secondary_muscles: values.secondary_muscles as Muscle[],
      equipment: values.equipment === '' ? null : (values.equipment as Equipment),
      description: values.description.trim() === '' ? null : values.description.trim(),
      aliases: parseAliases(values.aliases).filter((alias) => normalize(alias) !== normalize(name)),
    }
  })

export type ExerciseFormInput = z.input<typeof exerciseFormSchema>

/** Lo que recibe `create_exercise` / `update_exercise`. */
export interface ExercisePayload {
  name: string
  measurement_type: MeasurementType
  primary_muscles: Muscle[]
  secondary_muscles: Muscle[]
  equipment: Equipment | null
  description: string | null
  aliases: string[]
}

export function emptyExerciseForm(): ExerciseFormInput {
  return {
    name: '',
    measurement_type: '',
    primary_muscles: [],
    secondary_muscles: [],
    equipment: '',
    description: '',
    aliases: '',
  }
}

/** El borrador local guarda exactamente lo que se escribe en el formulario. */
export const exerciseDraftSchema = z.object({
  name: z.string(),
  measurement_type: z.string(),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()),
  equipment: z.string(),
  description: z.string(),
  aliases: z.string(),
})
