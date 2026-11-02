# Tareas: Privacidad y ciclo de vida de los datos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [contracts/privacy.md](contracts/privacy.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261101000200_privacy_lifecycle.sql`: `export_my_data()` y versión `2026-11-01` del aviso.
- [x] T002 Prueba pgTAP `supabase/tests/privacy_lifecycle.test.sql` con las pruebas guardianas de cascada y de cobertura de la exportación.

## Fase 2: Servidor (historia 2)

- [x] T003 [US2] `supabase/functions/_shared/admin.ts` (cliente anónimo) y `supabase/functions/delete-account/{handler,index}.ts`.
- [x] T004 [US2] `supabase/functions/delete-account/index.test.ts`: contraseña, límite, archivos antes que cuenta, fallo de archivos, idempotencia y registros sin datos personales.
- [x] T005 `supabase/config.toml`, `supabase/tests/config.test.ts` y limpieza global de resultados de IA en `supabase/functions/estimate-meal/index.ts`.

## Fase 3: Aplicación

- [x] T006 [US1] `app/src/features/privacy/zip.ts` y `exportData.ts` con sus pruebas unitarias.
- [x] T007 [US1] `app/src/features/privacy/api.ts` y `ExportSection.tsx`: JSON, ZIP de fotos, avance, cancelar y errores.
- [x] T008 [US2] `DeleteAccountSection.tsx`: contraseña, frase, errores y cierre de sesión.
- [x] T009 [US3] `PrivacySummary.tsx`, `PrivacyPage.tsx`, ruta `/privacidad`, entrada en «Más» y enlace en el perfil; copy `es.privacy`.
- [x] T010 [US3] Aviso de privacidad `2026-11-01` en `app/src/copy/privacy-notice.ts`.

## Fase 4: Pruebas y cierre

- [x] T011 Pruebas de componentes `app/tests/component/Privacy.test.tsx`.
- [x] T012 Prueba e2e `app/tests/e2e/privacy.spec.ts` (exportación, eliminación con fotos, aislamiento y accesibilidad a 375 y 1280 px).
- [x] T013 `Documentacion/privacidad.md`, `Documentacion/despliegue.md`, `supabase/README.md`, `README.md` y roadmap.
- [ ] T014 Correr pgTAP, Deno, lint, formato, typecheck y Vitest completos; leer el resultado.
