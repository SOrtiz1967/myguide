// Listas cerradas del catálogo de ejercicios (spec 005, research.md Decisión 5). La base las impone con
// restricciones `check` y la aplicación tiene las mismas en `app/src/features/exercises/exerciseLists.ts`;
// una prueba del frontend verifica que coinciden con la migración.

export const MEASUREMENT_TYPES = [
  'reps_weight',
  'reps_bodyweight',
  'duration',
  'distance_duration',
] as const
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]

export const MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
  'full_body',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const EQUIPMENT = [
  'body only',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'e-z curl bar',
  'kettlebells',
  'bands',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const TEXT_STATUSES = ['original', 'machine_translated', 'reviewed'] as const
export type TextStatus = (typeof TEXT_STATUSES)[number]

export const MAX_NAME = 120
export const MAX_ALIAS = 80
export const MAX_ALIASES = 10
export const MAX_DESCRIPTION = 4000
export const MAX_PRIMARY_MUSCLES = 5
export const MAX_SECONDARY_MUSCLES = 8
