// Aviso de privacidad (FR-029). Es un resumen breve, no una política legal completa: la redacción
// final y la política completa se definen en la spec 011. La versión debe existir como vigente en
// private.privacy_notice_versions (ver supabase/migrations/20261016000200_private_tables.sql).

export const PRIVACY_NOTICE_VERSION = '2026-10-16'

export const PRIVACY_NOTICE_POINTS = [
  'Guardamos tu correo y los datos que cargues: tu perfil y, más adelante, comidas, entrenamientos, sueño, mediciones y fotos.',
  'Son datos personales de salud. Solo tú puedes verlos con tu cuenta; no los publicamos ni los usamos para publicidad.',
  'Usamos servicios de terceros solo para lo necesario: enviar los correos de confirmación y verificar que eres una persona.',
  'Las fotos de progreso corporal nunca se envían a servicios externos de inteligencia artificial.',
  'Puedes consultar, corregir y eliminar tus registros. La exportación y la eliminación completa de la cuenta se agregarán antes de abrir la aplicación a más personas.',
  'MyGuide es una herramienta de seguimiento personal: no es un dispositivo médico ni reemplaza el consejo de profesionales.',
] as const
