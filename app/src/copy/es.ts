// Textos de la interfaz, centralizados (Principio VI: interfaz en español).
// Regla de lenguaje (Principio IV): sin tono culpabilizante ni moralizante.

// Cifras con separador de miles también en cuatro cifras ("1.350"); es-AR agrupa desde el primer millar.
const kcalFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const kcal = (value: number) => kcalFormat.format(value)

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
  // Spec 002 (catálogo de alimentos). Glosario de contracts/ui-routes.md: "Del catálogo" (nunca
  // "importado" ni "común"), "Propio", "Sin dato", "Traducción sin revisar".
  foods: {
    navLink: 'Alimentos',
    title: 'Alimentos',
    searchLabel: 'Buscar por nombre o marca',
    searchHint: 'Escribe al menos 2 letras.',
    searchTooShort: 'Escribe al menos 2 letras para buscar.',
    searching: 'Buscando…',
    loadMore: 'Ver más',
    loadingMore: 'Cargando más…',
    resultsCount: (count: number) => (count === 1 ? '1 resultado' : `${count} resultados`),
    tabsLabel: 'Origen de los alimentos',
    tabs: { all: 'Todos', catalog: 'Del catálogo', own: 'Mis alimentos' },
    originBadge: { catalog: 'Del catálogo', own: 'Propio', copy: 'Propio · copia' },
    noBrand: 'Sin marca',
    emptyTitle: 'No encontramos alimentos con esa búsqueda',
    emptyBody: 'Revisa cómo está escrito o crea el alimento con tus propios valores.',
    createNamed: (name: string) => `Crear "${name}"`,
    catalogEmpty: 'El catálogo todavía no tiene alimentos cargados.',
    ownEmpty: 'Todavía no creaste alimentos propios.',
    searchError: 'No pudimos buscar alimentos.',
    offlineSearch: 'No hay conexión. No pudimos buscar alimentos.',
    detailError: 'No pudimos cargar este alimento.',
    notFound: 'No encontramos este alimento',
    backToSearch: 'Volver a la búsqueda',
    newFood: 'Crear alimento',
    nutrition: {
      title: 'Valores nutricionales',
      missing: 'sin dato',
      labels: {
        energy_kcal: 'Energía',
        protein_g: 'Proteínas',
        carbs_g: 'Carbohidratos',
        sugars_g: 'de los cuales azúcares',
        fat_g: 'Grasas totales',
        saturated_fat_g: 'de las cuales saturadas',
        fiber_g: 'Fibra',
        sodium_mg: 'Sodio',
      },
    },
    portions: {
      title: 'Porciones',
      none: 'Sin porciones',
      amount: (name: string, text: string) => `${name}: ${text}`,
    },
    provenance: {
      title: 'Procedencia',
      own: 'Propio',
      ownBasedOnPrefix: 'Propio, basado en',
      catalog: (source: string, code: string, date: string) =>
        `Del catálogo · ${source} · código ${code} · importado el ${date}`,
      viewSources: 'Ver fuentes y licencias',
    },
    nameStatus: {
      machine_translated: 'traducción sin revisar',
      reviewed: 'traducción revisada',
      original: 'nombre original',
    },
    actions: {
      createMine: 'Crear mi versión',
      edit: 'Editar',
      delete: 'Eliminar',
      copy: 'Crear una copia',
      save: 'Guardar alimento',
      cancel: 'Cancelar',
      confirmDelete: 'Sí, eliminar',
      addPortion: 'Agregar porción',
      removePortion: 'Quitar porción',
    },
    form: {
      createTitle: 'Crear alimento',
      editTitle: 'Editar alimento',
      copyTitle: 'Crear mi versión',
      basisLegend: 'Los valores nutricionales son',
      basis: { '100g': 'Por 100 g', '100ml': 'Por 100 ml' },
      name: 'Nombre',
      brand: 'Marca (opcional)',
      portionLegend: (position: number) => `Porción ${position}`,
      portionName: 'Nombre de la porción',
      portionAmount: 'Cantidad',
      optional: 'Opcional',
      saved: 'Alimento guardado',
      deleted: 'Alimento eliminado',
      copyCreated: 'Creamos tu copia. Ya puedes editarla; el original no cambia.',
      editNotAllowed:
        'Los alimentos del catálogo no se pueden editar. Crea tu versión desde el detalle.',
      deleteFailed: 'No pudimos eliminar el alimento.',
      deleteTitle: '¿Eliminar este alimento?',
      deleteBody:
        'Se elimina solo de tu lista. Lo que registraste antes conserva sus propios valores.',
      draftRestored: 'Recuperamos lo que estabas escribiendo.',
      draftDiscard: 'Descartar borrador',
      coherenceNotice: (expected: number) =>
        `La energía no coincide con los macronutrientes, que suman cerca de ${expected} kcal. Puedes guardar igual.`,
    },
    errors: {
      nameRequired: 'Escribe un nombre.',
      nameTooLong: 'El nombre puede tener hasta 200 caracteres.',
      brandTooLong: 'La marca puede tener hasta 120 caracteres.',
      requiredEnergy: 'La energía es obligatoria.',
      decimal: 'Escribe un número, por ejemplo 12,5.',
      negative: 'El valor no puede ser negativo.',
      outOfRange: (max: string) => `Debe estar entre 0 y ${max}.`,
      macrosOver100: 'Proteínas, carbohidratos y grasas no pueden sumar más de 100 por cada 100.',
      subtotalOverTotal: 'Este valor no puede ser mayor que el total del que forma parte.',
      portionName: 'Escribe el nombre de la porción.',
      portionAmount: 'Escribe una cantidad mayor que cero y hasta 5.000.',
      portionDuplicate: 'Ya hay una porción con ese nombre.',
      tooManyPortions: 'Puedes cargar hasta 20 porciones.',
      saveFailed: 'No pudimos guardar el alimento. No se guardó nada.',
    },
    sources: {
      title: 'Fuentes y licencias',
      intro: 'El catálogo se armó con datos de estas fuentes. Cada una tiene su licencia.',
      license: 'Licencia',
      attribution: 'Atribución',
      lastImport: 'Última importación',
      foodCount: (count: number) =>
        count === 1 ? '1 alimento' : `${count.toLocaleString('es-AR')} alimentos`,
      siteLink: 'Sitio de la fuente',
      empty: 'Todavía no hay fuentes cargadas',
      error: 'No pudimos cargar las fuentes.',
      neverImported: 'Todavía no se importó',
    },
  },
  // Spec 003 (registro de comidas). Sin juicios sobre lo comido (Principio IV).
  meals: {
    navLink: 'Comidas',
    title: 'Registro de comidas',
    names: {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      snack: 'Merienda',
      dinner: 'Cena',
      extra: 'Colación',
    },
    addedTo: {
      breakfast: 'Agregado al desayuno',
      lunch: 'Agregado al almuerzo',
      snack: 'Agregado a la merienda',
      dinner: 'Agregado a la cena',
      extra: 'Agregado a la colación',
    },
    origin: { catalog: 'Del catálogo', own: 'Propio', manual: 'Manual', estimated: 'Estimado' },
    pending: 'Estimado, sin confirmar',
    pendingNote: 'Los valores estimados pueden contener errores. Revísalos antes de confirmar.',
    nutrients: {
      energy_kcal: 'Energía',
      protein_g: 'Proteínas',
      carbs_g: 'Carbohidratos',
      fat_g: 'Grasas',
    },
    day: {
      today: 'Hoy',
      previous: (label: string) => `Día anterior: ${label}`,
      next: (label: string) => `Día siguiente: ${label}`,
      pickDate: 'Elegir fecha',
      total: 'Total del día',
      subtotal: 'Subtotal',
      empty: 'Todavía no registraste nada este día',
      emptyHint: 'Agrega lo que comiste a la comida que corresponda.',
      mealEmpty: 'Sin registros',
      add: 'Agregar',
      addTo: (meal: string) => `Agregar a ${meal}`,
      loading: 'Cargando el día…',
      loadError: 'No pudimos cargar el día.',
      offlineLoad: 'No hay conexión. No pudimos cargar el día.',
      invalidDate: 'Esa fecha no es válida o está fuera del rango permitido.',
      goToday: 'Ir a hoy',
      foodGone: 'Este alimento ya no está disponible; se muestran los valores registrados.',
      closing: (label: string) => `Registrando en el ${label}`,
      closingHint: 'Todavía no empezaste el día de hoy.',
      startToday: 'Empezar el día de hoy',
    },
    add: {
      title: (meal: string) => `Agregar a ${meal}`,
      destination: (label: string) => `Se registrará en el ${label}`,
      switchDay: (label: string) => `Registrar en el ${label}`,
      meal: 'Comida',
      recents: 'Recientes',
      recentsEmpty: 'Todavía no registraste nada. Busca un alimento o escribe lo que comiste.',
      search: 'Buscar un alimento',
      searchHint: 'Escribe al menos 2 letras.',
      manual: 'Escribir a mano',
      confirm: 'Agregar',
      cancel: 'Cancelar',
      chooseOther: 'Elegir otro alimento',
      loadingFood: 'Cargando el alimento…',
      foodLoadError: 'No pudimos cargar el alimento.',
      draftRestored: 'Recuperamos lo que estabas agregando.',
      draftDiscard: 'Descartar borrador',
      noResults: 'No encontramos ese alimento.',
      createFood: 'Crear alimento',
    },
    quantity: {
      measure: 'Medida',
      grams: 'Gramos (g)',
      milliliters: 'Mililitros (ml)',
      amountGrams: 'Cantidad (g)',
      amountMilliliters: 'Cantidad (ml)',
      amountPortions: 'Número de porciones',
      portionOption: (name: string, amount: string) => `${name} (${amount})`,
      equivalent: (amount: string) => `Equivale a ${amount}`,
      preview: 'Valores para esta cantidad',
    },
    manual: {
      title: 'Escribir a mano',
      description: 'Qué comiste',
      quantityText: 'Cantidad (opcional)',
      quantityTextHint: 'Por ejemplo, "1 porción" o "2 rebanadas".',
      optional: 'Opcional',
      save: 'Agregar',
      draftRestored: 'Recuperamos lo que estabas escribiendo.',
      draftDiscard: 'Descartar borrador',
      back: 'Volver a la lista',
      errors: {
        descriptionRequired: 'Escribe qué comiste.',
        descriptionTooLong: 'La descripción puede tener hasta 200 caracteres.',
        quantityTextTooLong: 'La cantidad puede tener hasta 60 caracteres.',
        energyRequired: 'La energía es obligatoria.',
        decimal: 'Escribe un número, por ejemplo 12,5.',
        negative: 'El valor no puede ser negativo.',
        outOfRange: (max: string) => `Debe estar entre 0 y ${max}.`,
        subtotalOverTotal: 'Este valor no puede ser mayor que el total del que forma parte.',
      },
    },
    saveAsFood: {
      action: 'Guardar como alimento propio',
      title: 'Guardar como alimento propio',
      intro:
        'Los valores de este registro son para toda la cantidad. Indica cuánto pesa o mide para calcular los valores por 100.',
      basisLegend: 'Se mide en',
      grams: 'Gramos (g)',
      milliliters: 'Mililitros (ml)',
      amountGrams: 'Cuánto pesa (g)',
      amountMilliliters: 'Cuánto mide (ml)',
      save: 'Guardar alimento',
      cancel: 'Cancelar',
      saved: 'Alimento guardado en Mis alimentos',
      viewFood: 'Ver el alimento',
      errors: {
        amount: 'Escribe cuánto pesa o mide: un número mayor que 0 y hasta 5.000.',
      },
    },
    repeat: {
      action: 'Repetir en…',
      title: (meal: string) => `Repetir ${meal}`,
      day: 'Día de destino',
      meal: 'Comida de destino',
      next: 'Continuar',
      cancel: 'Cancelar',
      loadingPreview: 'Calculando qué se repetiría…',
      previewError: 'No pudimos preparar la repetición.',
      confirmTitle: (items: string) => `¿Repetir ${items}?`,
      confirmBody: (total: string, recalculated: number, copied: number, destination: string) =>
        `Se crean ${total} en ${destination}. ${recalculated} se recalculan con los valores actuales del alimento y ${copied} se copian tal cual estaban. Lo que ya registraste no cambia.`,
      confirm: 'Sí, repetir',
      failed: 'No pudimos repetir la comida. No se guardó nada.',
      done: (items: string) => `Se repitieron ${items}`,
      items: (count: number) => (count === 1 ? '1 ítem' : `${count} ítems`),
    },
    photo: {
      add: 'Agregar foto',
      replace: 'Reemplazar foto',
      remove: 'Eliminar foto',
      sending: 'Subiendo la foto…',
      privacy:
        'La foto es privada: solo la ves tú. Antes de guardarla se le quitan los datos ocultos, como la ubicación.',
      alt: (meal: string, day: string) => `Foto de ${meal} del ${day}`,
      enlarge: 'Ver más grande',
      shrink: 'Ver más chica',
      loadingImage: 'Cargando la foto…',
      imageError: 'No pudimos mostrar la foto.',
      retry: 'Reintentar',
      deleteTitle: '¿Eliminar la foto?',
      deleteBody: 'Se elimina solo la foto. Lo que registraste en esta comida no cambia.',
      confirmDelete: 'Sí, eliminar',
      cancel: 'Cancelar',
      uploaded: 'Foto guardada',
      removed: 'Foto eliminada',
      errors: {
        notImage: 'Elige una imagen (JPEG, PNG o WebP).',
        tooBig: 'La foto pesa más de 15 MB. Elige una más chica.',
        heic: 'Este navegador no puede leer fotos HEIC. Elige una foto en JPEG o PNG, o activa el formato "Más compatible" de la cámara.',
        unreadable: 'No pudimos leer esa imagen. Prueba con otra.',
        tooLarge: 'La foto es demasiado grande. Prueba con otra.',
        rateLimited: 'Subiste muchas fotos en poco tiempo. Espera un rato y vuelve a intentarlo.',
        failed: 'No pudimos guardar la foto. No se guardó nada.',
        deleteFailed: 'No pudimos eliminar la foto.',
      },
    },
    entry: {
      back: 'Volver al día',
      values: 'Valores registrados',
      editTitle: 'Corregir',
      meal: 'Comida',
      day: 'Día',
      save: 'Guardar cambios',
      saved: 'Cambios guardados',
      delete: 'Eliminar',
      deleteTitle: '¿Eliminar este registro?',
      deleteBody: 'Se elimina solo este registro. Tus alimentos no cambian.',
      confirmDelete: 'Sí, eliminar',
      cancel: 'Cancelar',
      deleteFailed: 'No pudimos eliminar el registro.',
      notFound: 'No encontramos este registro',
      loadError: 'No pudimos cargar este registro.',
      draftRestored: 'Recuperamos lo que estabas cambiando.',
      draftDiscard: 'Descartar borrador',
      noChanges: 'No hay cambios para guardar.',
      quantityLine: 'Cantidad',
    },
    errors: {
      quantity: 'Escribe una cantidad mayor que 0 y hasta 5.000.',
      portionCount: 'Escribe un número de porciones mayor que 0 y hasta 50.',
      foodGone: 'Ese alimento ya no está disponible. No se registró nada.',
      saveFailed: 'No pudimos registrar la comida. No se guardó nada.',
      invalidDate: 'Esa fecha no es válida o está fuera del rango permitido.',
    },
  },
  // Spec 004: objetivo de energía diaria y resumen del día. Todos los textos del objetivo viven aquí para
  // poder revisarlos juntos contra la lista de términos prohibidos (Principio IV, SC-005): sin sugerir
  // saltarse comidas, compensar ni restringir, y sin culpa ni juicio sobre lo registrado.
  goal: {
    cardTitle: 'Objetivo del día',
    invite: 'Fijar un objetivo de energía (opcional)',
    change: 'Cambiar objetivo',
    goalLine: (goal: number) => `Objetivo: ${kcal(goal)} kcal`,
    registered: (registered: number, atLeast: boolean) =>
      atLeast
        ? `Registrado: al menos ${kcal(registered)} kcal`
        : `Registrado: ${kcal(registered)} kcal`,
    percent: (percent: number) => `${kcal(percent)} % del objetivo`,
    /** La frase principal del estado. Con ítems sin dato de energía el restante es un máximo. */
    statement: (
      summary:
        | { state: 'under' | 'met'; remaining: number; lowerBound: boolean }
        | { state: 'over'; difference: number; lowerBound: boolean },
    ): string => {
      if (summary.state === 'over') {
        return `Registraste ${summary.lowerBound ? 'al menos ' : ''}${kcal(summary.difference)} kcal más que el objetivo de este día.`
      }
      if (summary.lowerBound) return `Restan como máximo ${kcal(summary.remaining)} kcal`
      return summary.state === 'met'
        ? 'Restan 0 kcal. Lo registrado coincide con el objetivo.'
        : `Restan ${kcal(summary.remaining)} kcal`
    },
    /** La cuenta que explica la cifra: "2.000 − 1.350 = 650 kcal" o, al superarlo, "2.250 − 2.000 = 250 kcal". */
    equation: (summary: {
      goal: number
      registered: number
      state: 'under' | 'met' | 'over'
      remaining: number
      difference?: number
    }): string =>
      summary.state === 'over'
        ? `${kcal(summary.registered)} − ${kcal(summary.goal)} = ${kcal(-summary.remaining)} kcal`
        : `${kcal(summary.goal)} − ${kcal(summary.registered)} = ${kcal(summary.remaining)} kcal`,
    missingNote: (count: number) =>
      count === 1
        ? '1 ítem no tiene dato de energía y no suma.'
        : `${kcal(count)} ítems no tienen dato de energía y no suman.`,
    pendingNote: (pending: number) =>
      `Incluye ${kcal(pending)} kcal estimadas que todavía no confirmaste. Lo que resta depende de esa estimación.`,
    howTitle: 'Cómo se calcula',
    how: [
      'Restan = objetivo − registrado.',
      'Registrado es la suma de la energía de los ítems del día que tienen ese dato. Los ítems sin dato de energía no suman y se cuentan aparte.',
      'Las estimaciones que todavía no confirmaste suman y se muestran aparte.',
      'El objetivo es el que tenías ese día. Si lo cambias, rige desde hoy y los días anteriores no cambian.',
    ],
    loadError: 'No pudimos cargar el objetivo',
    lowGoalNote:
      'El objetivo está por debajo de 1.200 kcal. Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud.',
    validation: {
      empty: 'Escribe el objetivo en kcal.',
      notNumber: 'Escribe solo números, por ejemplo 2000.',
      notInteger: 'Escribe el objetivo en kcal enteras, sin decimales.',
      range: 'El objetivo debe estar entre 1.000 y 6.000 kcal.',
    },
    page: {
      title: 'Objetivo de energía diaria',
      explanation: 'Es una referencia que eliges tú. MyGuide no la cambia sola.',
      loading: 'Cargando el objetivo…',
      current: (goal: number, since: string) => `Vigente: ${kcal(goal)} kcal, desde el ${since}`,
      none: 'Todavía no fijaste un objetivo',
      fieldLabel: 'Energía por día (kcal)',
      fieldHelp: 'Entre 1.000 y 6.000',
      save: 'Guardar objetivo',
      saving: 'Guardando…',
      remove: 'Quitar objetivo',
      rule: 'El cambio rige desde hoy. Los días anteriores conservan el objetivo que tenían.',
      saved: 'Objetivo guardado. Rige desde hoy.',
      removed: 'Objetivo quitado. Rige desde hoy.',
      notSaved: 'No se guardó el objetivo.',
      draftRestored: 'Recuperamos lo que habías escrito.',
      draftDiscard: 'Descartar',
      back: 'Volver al día',
      removeDialog: {
        title: '¿Quitar el objetivo?',
        description:
          'Desde hoy no se mostrarán las calorías restantes ni el avance. Los días anteriores conservan el objetivo que tenían.',
        confirm: 'Quitar objetivo',
        cancel: 'Cancelar',
      },
    },
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
