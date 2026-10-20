// Ayudantes de las pruebas e2e de la spec 004 (objetivo de energía diaria). Solo para el stack local.
import { dbQuery } from './support'

/** El día de hoy (zona del navegador) más `offsetDays`, como AAAA-MM-DD. */
export function localDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return new Intl.DateTimeFormat('en-CA').format(date)
}

export function userId(email: string): string {
  return dbQuery(`select id from auth.users where email = '${email}'`)
}

/** Un ítem manual de la cuenta (todos llevan "e2e" en el nombre para poder limpiarlos). energy = null: sin dato. */
export function seedEntry(
  email: string,
  options: { name: string; energy: number | null; date?: string; meal?: string },
): void {
  const energy = options.energy === null ? 'null' : String(options.energy)
  dbQuery(
    `insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal) values ('${userId(email)}', '${options.date ?? localDate()}', '${options.meal ?? 'lunch'}', 'manual', '${options.name}', ${energy})`,
  )
}

/** Un ítem estimado todavía sin confirmar (ayudante de la base local `tests.create_pending_estimate`). */
export function seedPendingEstimate(email: string, energy: number, date = localDate()): void {
  dbQuery(`select tests.create_pending_estimate('${userId(email)}', '${date}', 'lunch', ${energy})`)
}

/** Agrega un cambio al historial del objetivo (kcal = null: se quitó), con la fecha y hora indicadas. */
export function seedGoal(
  email: string,
  kcal: number | null,
  effectiveFrom = localDate(),
  createdAt = 'now()',
): void {
  const value = kcal === null ? 'null' : String(kcal)
  const created = createdAt === 'now()' ? 'now()' : `'${createdAt}'`
  dbQuery(
    `select tests.create_energy_goal('${userId(email)}', '${effectiveFrom}', ${value}, ${created})`,
  )
}

/** Los valores guardados de la cuenta, del más viejo al más nuevo ('quitado' = se quitó el objetivo). */
export function savedGoals(email: string): string[] {
  const rows = dbQuery(
    `select coalesce(kcal::text, 'quitado') from public.energy_goals where user_id = '${userId(email)}' order by created_at`,
  )
  return rows === '' ? [] : rows.split('\n')
}
