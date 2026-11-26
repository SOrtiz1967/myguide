# Plan de implementación: Recuperación y fatiga

**Rama**: `034-recuperacion-fatiga` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Se agrega una tabla `session_checks` con una fila opcional por sesión de entrenamiento: el chequeo previo (sueño percibido, energía, fatiga, estrés, molestias) y el posterior (rendimiento percibido, sesión completada, dificultad). Los patrones («en tus últimas 8 sesiones de pierna, 4 ocurrieron después de dormir menos de 6 horas…») se calculan en el cliente comparando un **índice de rendimiento relativo** de cada sesión con el sueño **registrado** (spec 007) y con lo declarado en el chequeo, sin causalidad. Las señales persistentes producen una nota neutral que sugiere apoyo profesional, sin diagnóstico.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126001500_session_checks.sql` con `session_checks` (clave `session_id`) y la función `save_session_check`. El sueño ya registrado se lee de `daily_activity`; no se pide de nuevo.
- **Aplicación**: `app/src/features/training/recovery/` con `PreCheckForm` y `PostCheckForm` (en la pantalla de la sesión), `performanceIndex()` y `findPatterns()` (puros), `RecoveryPage` (ruta `/entrenamiento/recuperacion`) y `PersistentSignalNote`.
- **Pruebas**: Vitest con sesiones simuladas para el índice y los patrones (con y sin datos suficientes, lenguaje sin causalidad), pgTAP para la tabla y la función (campos opcionales, idempotencia, aislamiento), Playwright para el chequeo previo y posterior y la pantalla.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: datos de salud personales con RLS propia, escritura por función con sesión fresca, texto libre acotado, sin envío a servicios externos; entran en exportación y eliminación. |
| II | Se cumple: el chequeo es un registro de la persona; los patrones son derivados y no modifican nada. |
| IV | Se cumple: sin diagnóstico ni lenguaje culpabilizante; las señales persistentes sugieren apoyo profesional con neutralidad. |
| V | Se cumple: patrones como relaciones observadas, con período y cantidad de registros; datos faltantes como faltantes; sin causalidad. |
| VI | Se cumple: chequeo en pocos toques, accesible por teclado, 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Escalas de 1 a 5** para energía, fatiga, estrés, sueño percibido, rendimiento percibido y dificultad, con etiquetas en texto (por ejemplo «muy baja» a «muy alta»); todo opcional. Molestias: lista corta de zonas (opcional) y una nota de hasta 200 caracteres.
- **Un chequeo por sesión.** `session_id` es la clave; la sesión debe ser del dueño. Los campos previos se pueden completar con la sesión planificada o en curso; los posteriores, con la sesión en curso o completada.
- **Índice de rendimiento relativo** (por sesión). Para cada ejercicio de fuerza de la sesión, el volumen total (peso × repeticiones) dividido por la mediana de las últimas 4 sesiones previas del mismo ejercicio; el índice de la sesión es la mediana de esos cocientes. Requiere al menos 2 ejercicios con 4 sesiones previas. Es una comparación de la persona consigo misma.
- **Patrones.** Para un factor binario (por ejemplo, «dormir menos de 6 horas» según `daily_activity`, o «fatiga declarada alta»), se comparan los índices de las sesiones con el factor contra las sin el factor. Se muestra solo con al menos 8 sesiones con índice y al menos 3 en cada grupo. El texto indica período, cantidad de sesiones y la diferencia de medianas.
- **Señal persistente.** Fatiga alta o recuperación baja en al menos 5 chequeos consecutivos que abarquen 14 días o más. Muestra una nota neutral con sugerencia de apoyo profesional; se puede descartar y reaparece con una nueva señal.
- **Molestias.** Texto personal sin interpretación; no se usan en cálculos ni en recomendaciones salvo mostrarlas junto a la sesión.
- **Sin IA y sin servicios externos.**

## Contratos (función de base)

- `save_session_check(session_id uuid, pre jsonb, post jsonb, request_id uuid) returns void`: valida cada escala (enteros de 1 a 5), nota de 1 a 200 caracteres, zonas de la lista cerrada; mezcla con la fila existente (un campo omitido no borra); `null` explícito borra. Error `invalid_check:<motivo>:<campo>`.

## Estructura de archivos

```text
supabase/migrations/20261126001500_session_checks.sql
supabase/migrations/20261126001600_session_checks_privacy.sql
supabase/tests/session_checks.test.sql
app/src/features/training/recovery/{performanceIndex,findPatterns,persistentSignal,useChecks,api}.ts(x)
app/src/features/training/recovery/{PreCheckForm,PostCheckForm,RecoveryPage,PatternCard,PersistentSignalNote}.tsx
app/src/features/training/SessionPage.tsx
app/src/copy/es.ts
app/tests/{unit/performanceIndex.test.ts,unit/findPatterns.test.ts,component/PreCheckForm.test.tsx,e2e/recovery.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Revisión de textos: sin lenguaje causal ni diagnóstico (ninguna cadena debe nombrar enfermedades ni síndromes).
