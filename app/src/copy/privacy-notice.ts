// Aviso de privacidad (FR-029). Es un resumen breve; el detalle completo está en la pantalla «Tus datos» (`/privacidad`)
// y en Documentacion/privacidad.md (spec 011). La versión debe existir como vigente en
// private.privacy_notice_versions (ver supabase/migrations/20261101000200_privacy_lifecycle.sql).

export const PRIVACY_NOTICE_VERSION = '2026-11-01'

export const PRIVACY_NOTICE_POINTS = [
  'Guardamos tu correo y los datos que cargues: tu perfil, comidas, entrenamientos, sueño, actividad, mediciones, suplementos y fotos.',
  'Son datos personales de salud. Solo tú puedes verlos con tu cuenta; no los publicamos ni los usamos para publicidad.',
  'Usamos servicios de terceros solo para lo necesario: guardar tus datos (Supabase), enviar los correos (Brevo), verificar que eres una persona (Cloudflare Turnstile) y, si usas «Describir con IA», estimar esa comida (Google Gemini).',
  'Las fotos de progreso corporal nunca se envían a servicios externos de inteligencia artificial.',
  'Puedes consultar, corregir y eliminar tus registros, descargar todos tus datos y eliminar tu cuenta desde «Tus datos». Lo que elimines puede permanecer en las copias de seguridad del proveedor hasta 30 días.',
  'MyGuide es una herramienta de seguimiento personal: no es un dispositivo médico ni reemplaza el consejo de profesionales.',
] as const
