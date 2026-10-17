// Textos de la interfaz, centralizados (Principio VI: interfaz en español).
// Regla de lenguaje (Principio IV): sin tono culpabilizante ni moralizante.

export const es = {
  appName: 'MyGuide',
  common: {
    skipToContent: 'Saltar al contenido',
    loading: 'Cargando…',
    retry: 'Reintentar',
    emailInvalid: 'Escribe un correo válido.',
    passwordMismatch: 'Las contraseñas no coinciden.',
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
    captchaRejected: 'No pudimos verificar que eres una persona. Vuelve a intentarlo.',
    // FR-002
    weakPassword: 'La contraseña debe tener entre 10 y 72 caracteres.',
    // FR-020: nunca dar a entender que algo se guardó.
    offline: 'No hay conexión. Tus cambios no se guardaron.',
    generic: 'Algo salió mal. Inténtalo de nuevo.',
  },
  auth: {
    labels: {
      email: 'Correo electrónico',
      password: 'Contraseña',
      currentPassword: 'Contraseña actual',
      newPassword: 'Contraseña nueva',
      confirmPassword: 'Repetir contraseña nueva',
      privacyAccept: 'Leí el aviso de privacidad',
    },
    actions: {
      register: 'Crear cuenta',
      login: 'Ingresar',
      sendLink: 'Enviar enlace',
      savePassword: 'Guardar contraseña',
      changePassword: 'Cambiar contraseña',
      resend: 'Reenviar enlace',
      logout: 'Cerrar sesión',
    },
    titles: {
      register: 'Crear cuenta',
      login: 'Ingresar',
      recover: 'Recuperar contraseña',
      reset: 'Nueva contraseña',
      emailConfirmed: 'Correo confirmado',
      linkInvalid: 'Enlace no válido',
      privacyNotice: 'Aviso de privacidad',
    },
    passwordHint: 'Usa entre 10 y 72 caracteres. No hace falta mezclar símbolos.',
    privacyRequired: 'Marca que leíste el aviso de privacidad para crear la cuenta.',
    // FR-005: la respuesta es la misma exista o no la cuenta.
    recoverySent:
      'Si el correo está registrado y confirmado, te enviamos un enlace para crear una contraseña nueva. Puede tardar unos minutos.',
    recoveryRule: 'Solo podemos enviar el enlace a correos que ya confirmaste.',
    currentPasswordWrong: 'La contraseña actual no es correcta.',
    passwordChanged: 'Contraseña actualizada. Cerramos tus otras sesiones.',
    passwordReset: 'Contraseña actualizada. Ya puedes ingresar con la nueva.',
    resetLinkInvalid: 'El enlace no es válido o venció. Pide uno nuevo.',
    sessionExpired: 'Tu sesión venció por inactividad. Ingresa de nuevo.',
    verifyBanner: 'Confirma tu correo para poder recuperar tu contraseña si la olvidas.',
    verifyResent: 'Te enviamos el enlace. Revisa tu correo.',
    verifyTooSoon: 'Espera un minuto antes de pedir otro enlace.',
    verifyDailyLimit: 'Llegaste al máximo de enlaces por hoy. Inténtalo mañana.',
    verifyEmailNotSent: 'No pudimos enviar el correo de confirmación. Puedes reintentar.',
    emailConfirmedBody: 'Listo, tu correo quedó confirmado.',
    linkInvalidBody: 'El enlace venció, ya se usó o no es válido.',
    goToLogin: 'Ir a ingresar',
    goToStart: 'Ir al inicio',
    noAccount: '¿No tienes cuenta?',
    haveAccount: '¿Ya tienes cuenta?',
    forgotPassword: '¿Olvidaste tu contraseña?',
  },
  home: {
    title: 'Inicio',
  },
  profile: {
    title: 'Perfil',
    summaryTitle: 'Tus datos',
    formTitle: 'Editar perfil',
    labels: {
      birthDate: 'Fecha de nacimiento',
      sex: 'Sexo',
      height: 'Altura (cm)',
      timezone: 'Zona horaria',
    },
    sexOptions: {
      unspecified: 'Prefiero no indicarlo',
      female: 'Femenino',
      male: 'Masculino',
    },
    notInformed: 'No informado',
    save: 'Guardar perfil',
    saved: 'Perfil guardado',
    draftRestored: 'Recuperamos lo que estabas escribiendo.',
    draftDiscard: 'Descartar borrador',
    loading: 'Cargando tu perfil',
    loadError: 'No pudimos cargar tu perfil.',
    chooseTimezone: 'Elige tu zona horaria',
    timezoneNoticeTitle: 'Zona horaria del dispositivo',
    timezoneNoticeSame: 'Todavía no elegiste una zona horaria.',
    timezoneNoticeDifferent: 'Es distinta de la que tienes guardada.',
    useDeviceTimezone: (timezone: string) => `Usar ${timezone}`,
    deviceTimezoneIs: (timezone: string) => `La zona horaria de tu dispositivo es ${timezone}.`,
    errors: {
      height: 'La altura debe estar entre 50 y 250 cm.',
      birthDate: 'La fecha de nacimiento no es válida.',
      timezone: 'Elige una zona horaria válida.',
      sex: 'Elige una de las opciones.',
    },
    emptyTitle: 'Todavía no completaste tu perfil',
    emptyBody:
      'Necesitamos tu fecha de nacimiento, tu altura y tu zona horaria para las estimaciones y para interpretar bien las fechas.',
    emptyAction: 'Completar perfil',
  },
  offline: {
    banner:
      'Sin conexión. MyGuide necesita internet para guardar y mostrar tus datos: no se guardará nada hasta que vuelva la conexión.',
    pageTitle: 'Sin conexión',
    pageBody:
      'MyGuide necesita conexión a internet para funcionar. Cuando vuelva, podrás seguir donde estabas.',
    reload: 'Reintentar',
  },
} as const
