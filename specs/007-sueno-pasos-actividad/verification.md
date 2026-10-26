# Verificación: Sueño, pasos y actividad (registro manual)

**Fecha**: 2026-10-26

| Requisito | Dónde se comprueba | Resultado |
|---|---|---|
| FR-001 a FR-006 (registrar, rangos, fecha, un valor por día y fuente, idempotencia) | `daily_activity.test.sql`, `activity.test.ts`, `ActivityPage.test.tsx`, `activity.spec.ts` | Cumple |
| FR-007 a FR-009 (último valor, historial, corregir, eliminar, «Sin dato») | `ActivityPage.test.tsx`, `activity.spec.ts` | Cumple |
| FR-010 (sin juicios ni metas) | `activity.test.ts` (lista de términos prohibidos); sin gráficos ni comparaciones | Cumple |
| FR-011 (privacidad) | `daily_activity.test.sql`, `activity.spec.ts` (token de otra cuenta por la API real) | Cumple |
| FR-012 y FR-013 (borrador, errores, accesibilidad) | `ActivityPage.test.tsx`, `activity.spec.ts` (axe) | Cumple |

Suite: `npm run typecheck`, lint, format, Vitest (90 archivos, 1 064 pruebas), pgTAP (50 archivos, 1 342 pruebas) y e2e de actividad en verde.
