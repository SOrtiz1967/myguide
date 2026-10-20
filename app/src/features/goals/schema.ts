import { z } from 'zod'
import { es } from '../../copy/es'

// Las mismas reglas que set_energy_goal en la base de datos (FR-004), para que la persona vea el error
// al escribir y no recién al guardar. La base las vuelve a imponer.
export const MIN_GOAL_KCAL = 1000
export const MAX_GOAL_KCAL = 6000
/** Por debajo de este valor se guarda igual y se muestra una nota informativa (FR-005). */
export const LOW_GOAL_KCAL = 1200

export type GoalParse = { ok: true; kcal: number } | { ok: false; message: string }

const THOUSANDS = /^\d{1,3}(\.\d{3})+$/
const DECIMAL = /^\d+([.,]\d+)?$/

/**
 * Lee el objetivo escrito por la persona, en este orden:
 * 1. un entero con punto de miles ("2.000", "12.000") vale sin los puntos;
 * 2. si no, un número con coma o punto decimal ("2000", "2000,0", "1800.5");
 * 3. el resultado debe ser entero ("1800,5" se rechaza; "2000,0" vale 2000) y estar entre 1.000 y 6.000.
 */
export function parseGoalInput(text: string): GoalParse {
  const v = es.goal.validation
  const value = text.trim()
  if (value === '') return { ok: false, message: v.empty }

  let kcal: number
  if (THOUSANDS.test(value)) {
    kcal = Number(value.replaceAll('.', ''))
  } else if (DECIMAL.test(value)) {
    kcal = Number(value.replace(',', '.'))
  } else {
    return { ok: false, message: v.notNumber }
  }

  if (!Number.isInteger(kcal)) return { ok: false, message: v.notInteger }
  if (kcal < MIN_GOAL_KCAL || kcal > MAX_GOAL_KCAL) return { ok: false, message: v.range }
  return { ok: true, kcal }
}

/** El campo del formulario: texto que se valida y se convierte en kcal enteras. */
export const goalFormSchema = z
  .object({ kcal: z.string() })
  .superRefine((values, ctx) => {
    const parsed = parseGoalInput(values.kcal)
    if (!parsed.ok) ctx.addIssue({ code: 'custom', path: ['kcal'], message: parsed.message })
  })
  .transform((values) => {
    const parsed = parseGoalInput(values.kcal)
    return { kcal: parsed.ok ? parsed.kcal : 0 }
  })

export type GoalFormInput = z.input<typeof goalFormSchema>
export type GoalFormValues = z.output<typeof goalFormSchema>
