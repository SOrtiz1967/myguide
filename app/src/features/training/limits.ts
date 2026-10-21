// Límites de rutinas y sesiones (spec 006, research.md Decisión 13). La base los reimpone con restricciones
// `check`; estos son los mismos valores para validar en el cliente y dar el error al escribir.

export const MAX_ROUTINE_NAME = 80
/** Ejercicios por rutina, por plan y realizados por sesión. */
export const MAX_EXERCISES = 30
/** Series planificadas (1 a 20) y realizadas (0 a 20) por ejercicio. */
export const MAX_SETS = 20
export const MAX_REPS = 999
export const MAX_WEIGHT_KG = 999.9
/** 24 horas, en segundos. */
export const MAX_DURATION_S = 86400
export const MAX_DISTANCE_KM = 999.9
export const MAX_SESSION_NOTE = 1000
export const MAX_EXERCISE_NOTE = 500
export const MIN_EFFORT = 1
export const MAX_EFFORT = 10
