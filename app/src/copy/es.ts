// Textos de la interfaz, centralizados (Principio VI: interfaz en español).
// Regla de lenguaje (Principio IV): sin tono culpabilizante ni moralizante.

export const es = {
  appName: 'MyGuide',
  common: {
    skipToContent: 'Saltar al contenido',
    loading: 'Cargando…',
    retry: 'Reintentar',
  },
  errors: {
    // FR-005: mismo mensaje exista o no la cuenta.
    invalidCredentials: 'El correo o la contraseña no son correctos.',
    // Decisión del autor (research.md, Decisión 10): se acepta revelar que el correo existe.
    accountExists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
    // FR-006: límite por IP, sin datos de la cuenta.
    rateLimited: 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    // FR-008: captcha no disponible, solo en registro y recuperación.
    captchaUnavailable: 'No pudimos verificar que eres una persona. Reintenta en unos minutos.',
    // FR-002
    weakPassword: 'La contraseña debe tener entre 10 y 72 caracteres.',
    // FR-020: nunca dar a entender que algo se guardó.
    offline: 'No hay conexión. Tus cambios no se guardaron.',
    generic: 'Algo salió mal. Inténtalo de nuevo.',
  },
} as const
