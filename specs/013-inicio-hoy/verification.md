# Verificación: Inicio «Hoy»

**Spec**: 013-inicio-hoy | **Fecha**: 2026-10-26

| Requisito | Dónde se comprueba | Resultado |
|---|---|---|
| FR-001 a FR-005 (calorías: cifras de la tarjeta del día, sin objetivo, vacío, enlaces) | `HomeBlocks.test.tsx`, `home.spec.ts` | Cumple |
| FR-006 a FR-009 (entrenamiento: en curso, de hoy y vencidas con acciones, invitación) | `HomeBlocks.test.tsx`, `home.spec.ts` | Cumple |
| FR-010 a FR-013 (accesos y últimos registros, datos faltantes) | `HomeBlocks.test.tsx`, `home.spec.ts` | Cumple |
| FR-014 y FR-015 (avisos existentes; cada bloque falla por su cuenta) | `HomePage.test.tsx`, `HomeBlocks.test.tsx`, `home.spec.ts` (se fuerza un 500 en las comidas) | Cumple |
| FR-017 (sin conexión) | `HomeBlocks.test.tsx` | Cumple |
| FR-019 (lenguaje neutral) | `homeCopy.test.ts` | Cumple |
| FR-020 (accesibilidad y responsive) | `home.spec.ts` (axe, sin desplazamiento horizontal en 375 y 1280 px) | Cumple |

Sin base de datos nueva: no hay migraciones ni pruebas pgTAP propias.

Suite: format, lint, `npm run typecheck`, Vitest (86 archivos, 1 036 pruebas) y e2e del inicio (4) en verde.
