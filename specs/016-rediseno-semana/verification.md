# Verificación: spec 016

**Fecha**: 2026-10-27

| Requisito | Dónde se comprueba | Resultado |
|---|---|---|
| FR-001, FR-002 (semana lunes a domingo, estados y tolerancia de ±10 %) | `week.test.ts`, `WeekStrip.test.tsx`, `week.spec.ts` (1.000 / 2.000 / 2.600 kcal sobre 2.000) | Cumple |
| FR-003 (estados de entrenamiento) | `week.test.ts`, `WeekStrip.test.tsx`, `week.spec.ts` (hecho y sin registrar) | Cumple |
| FR-004 (sin juicios ni rachas) | `week.test.ts` (`findTrainingForbidden` sobre `es.week`) | Cumple |
| FR-005 (un control por día con etiqueta completa) | `WeekStrip.test.tsx`, axe en `week.spec.ts` | Cumple |
| FR-006 (panel reutiliza `GoalSummary` y acciones de entrenamiento) | `HomeBlocks.test.tsx`, `home.spec.ts`, `week.spec.ts` | Cumple |
| FR-007 (cada bloque falla por su cuenta; sin conexión) | `WeekStrip.test.tsx`, `HomeBlocks.test.tsx`, `home.spec.ts` | Cumple |
| FR-008 (tema por tokens, contraste) | axe en todas las pantallas (`a11y*.spec.ts`, escritorio y móvil) | Cumple |
| FR-009 (menú sin consultas) | `session-ui.test.tsx` (carcasa sin proveedor de datos) | Cumple |
| FR-010 (recordatorio de peso como preferencia) | `onboarding_profile.test.sql`, `week.spec.ts` | Cumple |
| Menú en escritorio y en 360 px, sin desbordes | `week.spec.ts`, `responsive*.spec.ts` | Cumple |

Suite: format, lint, `npm run typecheck`, Vitest (96 archivos, 1 114 pruebas; una prueba de rutinas falló una vez bajo carga y pasa sola), pgTAP (51 archivos, 1 358 pruebas) y e2e en escritorio, `mobile` y `pwa` en verde. La medición de la foto de 12 MP (`meals-measure-photo`) es sensible a la carga de la máquina: falla en tandas largas y pasa sola.

Nota de entorno: `supabase db reset` borra el catálogo cargado en local; se restaura con `npm run import:muestra` y `npm run import:ejercicios`.
