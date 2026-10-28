import { useQuery } from '@tanstack/react-query'
import { goalOn } from '../goals/goalHistory'
import { summarizeDay } from '../goals/daySummary'
import { useGoalHistory } from '../goals/useGoalHistory'
import { fetchEntriesBetween, type WeekEntry } from '../meals/api'
import { fetchWeightsBetween } from '../measures/api'
import { fetchSessionsBetween, type SessionSummary } from '../training/api'
import {
  calorieState,
  trainingState,
  weekDays,
  type CalorieState,
  type TrainingState,
} from './week'

export interface DayInfo {
  date: string
  goal: number | null
  registered: number
  entries: number
  calorie: CalorieState | null
  training: TrainingState | null
  sessions: SessionSummary[]
}

/**
 * Los datos de los siete días de una semana: ítems, sesiones y el objetivo de cada día. Cada consulta
 * falla por su cuenta; mientras una no llega, su parte de cada día es `null`.
 */
export function useWeek(anchor: string, today: string) {
  const days = weekDays(anchor)
  const [from, to] = [days[0]!, days[6]!]
  const entries = useQuery({
    queryKey: ['meals', 'week', from, to],
    queryFn: () => fetchEntriesBetween(from, to),
  })
  const sessions = useQuery({
    queryKey: ['training', 'week', from, to],
    queryFn: () => fetchSessionsBetween(from, to),
  })
  const goals = useGoalHistory()
  const weights = useQuery({
    queryKey: ['measures', 'week', from, to],
    queryFn: () => fetchWeightsBetween(from, to),
  })

  const caloriesReady = entries.isSuccess && goals.isSuccess
  const infos: DayInfo[] = days.map((date) => {
    const dayEntries: WeekEntry[] = (entries.data ?? []).filter((e) => e.log_date === date)
    const goal = goals.data ? goalOn(goals.data, date) : null
    const registered = summarizeDay(dayEntries, goal).registered
    const daySessions = (sessions.data ?? []).filter((s) => s.session_date === date)
    return {
      date,
      goal,
      registered,
      entries: dayEntries.length,
      calorie: caloriesReady
        ? calorieState({ date, today, goal, registered, entries: dayEntries.length })
        : null,
      training: sessions.isSuccess ? trainingState(daySessions, date, today) : null,
      sessions: daySessions,
    }
  })

  return { days: infos, entries, sessions, goals, weights }
}
