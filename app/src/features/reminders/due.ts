// Spec 021: cuándo corresponde un aviso. Función pura, sin acceso a datos.

export const REMINDER_KINDS = ['weight', 'photos', 'supplements'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

export type Frequency = 'daily' | 'every_n_days' | 'weekdays'

export interface Reminder {
  kind: ReminderKind
  enabled: boolean
  frequency: Frequency
  /** Solo con «cada tantos días» (2 a 30). */
  every_n: number | null
  /** Solo con «ciertos días»: 1 = lunes a 7 = domingo. */
  weekdays: number[] | null
  /** «Más tarde»: el aviso no vuelve hasta después de esta fecha. */
  snoozed_until: string | null
}

export const MIN_EVERY_N = 2
export const MAX_EVERY_N = 30

const DAY_MS = 86_400_000
const toDay = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS)

/** Lunes = 1 … domingo = 7, para una fecha AAAA-MM-DD. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export interface DueContext {
  today: string
  /** Fecha del último registro del tipo (peso o foto); nulo si nunca hubo uno o no aplica. */
  lastDoneOn: string | null
  /** Hoy ya está registrado lo pedido (o no hay nada que registrar). */
  doneToday: boolean
}

/**
 * ¿Corresponde mostrar el aviso hoy? No si está apagado, si se pospuso hasta mañana o más, ni si hoy ya está
 * registrado. «Todos los días» y «ciertos días» corresponden en esos días; «cada tantos días» cuenta desde el último
 * registro (o corresponde si nunca hubo uno).
 */
export function isDue(reminder: Reminder, context: DueContext): boolean {
  if (!reminder.enabled) return false
  if (reminder.snoozed_until !== null && reminder.snoozed_until > context.today) return false
  if (context.doneToday) return false
  switch (reminder.frequency) {
    case 'daily':
      return true
    case 'weekdays':
      return (reminder.weekdays ?? []).includes(isoWeekday(context.today))
    case 'every_n_days': {
      if (reminder.every_n === null) return false
      if (context.lastDoneOn === null) return true
      return toDay(context.today) - toDay(context.lastDoneOn) >= reminder.every_n
    }
  }
}
