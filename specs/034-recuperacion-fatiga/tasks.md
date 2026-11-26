# Tareas: Recuperación y fatiga

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001500_session_checks.sql`: tabla `session_checks` (clave `session_id`; chequeo previo con sueño percibido, energía, fatiga, estrés y molestias; posterior con rendimiento percibido, sesión completada y dificultad; escalas de 1 a 5, zonas de lista cerrada, nota de 1–200 caracteres; todo opcional; `user_id`, RLS de lectura propia, sin escritura directa) y función `save_session_check(session_id, pre jsonb, post jsonb, request_id)` (`security definer`, `private.is_session_fresh()`, idempotente; la sesión debe ser del dueño; un campo omitido no borra, `null` explícito borra). Error `invalid_check:<motivo>:<campo>`. El sueño ya registrado se lee de `daily_activity` y no se pide de nuevo.
- [ ] T002 Migración `supabase/migrations/20261126001600_session_checks_privacy.sql`: tabla en `export_my_data()` y borrado en cascada; los datos no se envían a proveedores externos.
- [ ] T003 Prueba pgTAP `supabase/tests/session_checks.test.sql`: campos opcionales, rangos, mezcla y borrado con `null`, idempotencia, sesión ajena, aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Registrar cómo llego y cómo salí (P1)

- [ ] T004 [US1] `app/src/features/training/recovery/{useChecks,api}.ts` y copy en `app/src/copy/es.ts` (etiquetas «muy baja» a «muy alta», neutrales).
- [ ] T005 [US1] `PreCheckForm.tsx` y `PostCheckForm.tsx` integrados en `SessionPage.tsx`: todo opcional, completar el previo en menos de 15 segundos, accesible por teclado y sin desplazamiento horizontal a 360 px; editar y eliminar registros; molestias como texto personal sin interpretación.

## Fase 3: Historia 2 — Patrones entre recuperación y rendimiento (P2)

- [ ] T006 [US2] `performanceIndex.ts` (puro): por ejercicio de fuerza, volumen de la sesión sobre la mediana de las últimas 4 sesiones previas; índice de sesión = mediana de los cocientes; requiere al menos 2 ejercicios con 4 sesiones previas; prueba `app/tests/unit/performanceIndex.test.ts`.
- [ ] T007 [US2] `findPatterns.ts` (puro): factor binario (sueño menor a 6 h de `daily_activity`, fatiga declarada alta) contra índices de sesiones sin el factor; mínimo de 8 sesiones con índice y 3 en cada grupo, declarado como criterio de producto; la diferencia de medianas debe superar el ruido de medición del rendimiento (~4 %, ver `research.md`; considerar subir el 5 % inicial); texto con período, cantidad de sesiones y la aclaración de relación observada, sin causalidad; prueba `app/tests/unit/findPatterns.test.ts`.
- [ ] T008 [US2] `RecoveryPage.tsx` (ruta `/entrenamiento/recuperacion`) y `PatternCard.tsx`: cualquier indicador como estimación con rango, sin bloquear ni desaconsejar entrenar; lenguaje «posible fatiga acumulada», sin diagnosticar.

## Fase 4: Historia 3 — Señales que merecen atención profesional (P2)

- [ ] T009 [US3] `persistentSignal.ts` y `PersistentSignalNote.tsx`: fatiga alta o recuperación baja en al menos 5 chequeos consecutivos que abarquen 14 días o más muestra una nota neutral que sugiere apoyo profesional, sin diagnóstico ni condiciones nombradas; descartable y reaparece solo con una señal nueva.

## Fase 5: Pruebas y cierre

- [ ] T010 Prueba de componentes `app/tests/component/PreCheckForm.test.tsx` y revisión de textos (ninguna cadena con lenguaje causal ni diagnóstico).
- [ ] T011 Prueba e2e `app/tests/e2e/recovery.spec.ts` (chequeo previo y posterior, pocos datos sin patrón, señal persistente, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T012 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T013 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.
