# Contrato: rutas, textos y estados de la interfaz

**Feature**: 004-objetivo-calorico-resumen | Toda la interfaz en español, con tratamiento de "tú" como el resto de la aplicación. La ruta es privada (`RequireAuth`).

## Rutas

| Ruta | Propósito | Historia |
|---|---|---|
| `/objetivo` | Ver, fijar, cambiar y quitar el objetivo de energía diaria | 1, 4 (nota), 5 |
| `/comidas/:fecha` (spec 003) | Se agrega la tarjeta **"Objetivo del día"** arriba del total del día | 1, 2, 3, 4, 5 |

`/objetivo?volver=AAAA-MM-DD` vuelve a ese día al terminar; sin parámetro vuelve a `/comidas`. No hay un enlace nuevo en la cabecera: el objetivo se abre desde la tarjeta del día.

## La tarjeta "Objetivo del día" (`GoalSummary`)

Una sección con título accesible ("Objetivo del día") que se agrega **arriba** del total del día de la spec 003, que no cambia (sigue mostrando energía y macronutrientes con sus faltantes).

### Sin objetivo en ese día

- Se muestra **solo** "Registrado: 1.350 kcal" (con las aclaraciones de abajo si corresponden).
- Si el día es hoy o futuro: el enlace "Fijar un objetivo de energía (opcional)" a `/objetivo`.
- Si el día es pasado: nada más. No se muestran restantes, porcentaje ni barra, ni vacíos ni en cero (FR-002, SC-009).

### Con objetivo en ese día

| Elemento | Texto de ejemplo |
|---|---|
| Objetivo | "Objetivo: 2.000 kcal" |
| Registrado | "Registrado: 1.350 kcal" |
| Restantes | "Restan 650 kcal" |
| Cuenta | "2.000 − 1.350 = 650 kcal" |
| Avance | "68 % del objetivo" (texto; la barra es decorativa y está oculta a los lectores de pantalla) |
| Enlace | "Cambiar objetivo" a `/objetivo?volver=<día>` |
| Desplegable | "Cómo se calcula" |

### Estados del resumen

| Estado | Frase principal | Cuenta |
|---|---|---|
| `under` | "Restan 650 kcal" | "2.000 − 1.350 = 650 kcal" |
| `met` | "Restan 0 kcal. Lo registrado coincide con el objetivo." | "2.000 − 2.000 = 0 kcal" |
| `over` | "Registraste 250 kcal más que el objetivo de este día." | "2.250 − 2.000 = 250 kcal" |

La barra mide `min(percent, 100)` %. En `over` es del mismo color que en `under`: sin color de error (`danger`), sin íconos de advertencia y sin cambio de grosor ni de tipografía.

### Aclaraciones de incertidumbre

Aparecen **solo cuando corresponden** (FR-015 a FR-017); si todos los ítems tienen energía y están confirmados, no hay ninguna.

| Situación | Texto |
|---|---|
| Ítems sin dato de energía (`missing > 0`), `under` | "Restan como máximo 650 kcal. 2 ítems no tienen dato de energía y no suman." |
| Ídem, `met` | "Restan como máximo 0 kcal. 1 ítem no tiene dato de energía y no suma." |
| Ídem, `over` | "Registraste al menos 250 kcal más que el objetivo de este día. 1 ítem no tiene dato de energía y no suma." |
| Hay ítems estimados sin confirmar (`pending > 0`) | "Incluye 300 kcal estimadas que todavía no confirmaste. Lo que resta depende de esa estimación." |
| Sin objetivo y con ítems sin dato | "Registrado: al menos 1.350 kcal. 2 ítems no tienen dato de energía y no suman." |

### "Cómo se calcula"

Un desplegable (`<details>`, accesible por teclado) con texto simple:

- "Restan = objetivo − registrado."
- "Registrado es la suma de la energía de los ítems del día que tienen ese dato. Los ítems sin dato de energía no suman y se cuentan aparte."
- "Las estimaciones que todavía no confirmaste suman y se muestran aparte."
- "El objetivo es el que tenías ese día. Si lo cambias, rige desde hoy y los días anteriores no cambian."

### Nota informativa (objetivo menor a 1.200 kcal)

Se muestra en la tarjeta del día y en la pantalla del objetivo, sin color ni ícono de advertencia:

> "El objetivo está por debajo de 1.200 kcal. Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud."

## La pantalla `/objetivo`

| Parte | Contenido |
|---|---|
| Título | "Objetivo de energía diaria" |
| Explicación | "Es una referencia que eliges tú. MyGuide no la cambia sola." |
| Vigente | "Vigente: 2.000 kcal, desde el 12 de octubre" (o "Todavía no fijaste un objetivo") |
| Campo | "Energía por día (kcal)" con ayuda "Entre 1.000 y 6.000" |
| Botones | "Guardar objetivo" · "Quitar objetivo" (solo si hay uno; abre un diálogo de confirmación) |
| Aclaración | "El cambio rige desde hoy. Los días anteriores conservan el objetivo que tenían." |

### Estados por pantalla

| Pantalla | Carga | Vacío | Éxito | Error |
|---|---|---|---|---|
| Tarjeta del día | junto con el día ("Cargando el día…") | sin objetivo: ver arriba | cifras y aclaraciones | si falla solo el historial del objetivo, el día se ve igual y la tarjeta muestra "No pudimos cargar el objetivo" con "Reintentar" |
| `/objetivo` | "Cargando el objetivo…" | "Todavía no fijaste un objetivo" | "Objetivo guardado. Rige desde hoy." / "Objetivo quitado. Rige desde hoy." | valor inválido: mensaje por campo; sin conexión o fallo: "No se guardó…" y se conserva el borrador |

### Mensajes de validación (FR-003, FR-004)

| Caso | Mensaje |
|---|---|
| Vacío | "Escribe el objetivo en kcal." |
| No es un número | "Escribe solo números, por ejemplo 2000." |
| No es entero | "Escribe el objetivo en kcal enteras, sin decimales." |
| Fuera del rango | "El objetivo debe estar entre 1.000 y 6.000 kcal." |

## Lenguaje (Principio IV) — verificado

Todos estos textos viven en `copy/es.ts` bajo `goal`. Ninguno contiene los términos de `app/tests/support/forbiddenTerms.ts` (ayuno, saltar, compensar, quemar, ejercicio, culpa, exceso, "te pasaste", "mal", dieta, "tienes que", etc.; ver `research.md`, Decisión 5). Esa prueba recorre todos los textos con valores de ejemplo para cada estado, y se repite sobre el texto renderizado en la prueba de componente y en la e2e del estado `over`.

## Accesibilidad y responsive

- El estado se dice con palabras ("Restan…", "Registraste… más que…"); el color nunca es el único canal. La barra es decorativa.
- La tarjeta es una `section` con título; el desplegable y el diálogo de confirmación se usan con teclado; el foco vuelve al disparador al cerrar el diálogo.
- A 375 px de ancho las cifras se apilan y la cuenta no desborda; áreas táctiles de 44 px o más (SC-008).
