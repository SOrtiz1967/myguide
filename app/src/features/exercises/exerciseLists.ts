// Listas cerradas del catálogo de ejercicios (spec 005, FR-014 y FR-024; research.md Decisión 5).
// La base las impone con restricciones `check`; una prueba verifica que estos códigos coinciden con las
// de la migración. Agregar un valor es un cambio de la aplicación, no de los datos.

export const MEASUREMENT_TYPES = [
  'reps_weight',
  'reps_bodyweight',
  'duration',
  'distance_duration',
] as const
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  reps_weight: 'Repeticiones y peso',
  reps_bodyweight: 'Repeticiones (peso corporal)',
  duration: 'Tiempo',
  distance_duration: 'Distancia y tiempo',
}

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

const MUSCLE_LABELS: Record<Muscle, string> = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Pantorrillas',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Zona lumbar',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
  full_body: 'Cuerpo completo',
}

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

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  'body only': 'Peso corporal',
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  cable: 'Polea',
  machine: 'Máquina',
  'e-z curl bar': 'Barra Z',
  kettlebells: 'Pesa rusa',
  bands: 'Bandas elásticas',
  'medicine ball': 'Pelota medicinal',
  'exercise ball': 'Pelota de ejercicio',
  'foam roll': 'Rodillo de espuma',
  other: 'Otro',
}

export const measurementLabel = (type: MeasurementType): string => MEASUREMENT_LABELS[type]
export const muscleLabel = (muscle: Muscle): string => MUSCLE_LABELS[muscle]
export const equipmentLabel = (equipment: Equipment): string => EQUIPMENT_LABELS[equipment]

export const isMuscle = (value: string): value is Muscle =>
  (MUSCLES as readonly string[]).includes(value)
export const isEquipment = (value: string): value is Equipment =>
  (EQUIPMENT as readonly string[]).includes(value)
export const isMeasurementType = (value: string): value is MeasurementType =>
  (MEASUREMENT_TYPES as readonly string[]).includes(value)
