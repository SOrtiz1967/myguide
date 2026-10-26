# Verificación: Peso y medidas (versión mínima)

**Fecha**: 2026-10-26

| Requisito | Dónde se comprueba | Resultado |
|---|---|---|
| FR-001 a FR-005 (registrar, rangos, fecha, un valor por día, idempotencia) | `body_measurements.test.sql`, `measures.test.ts`, `MeasuresPage.test.tsx`, `measures.spec.ts` | Cumple |
| FR-006 a FR-009 (último valor, historial, corregir, eliminar, «Sin dato») | `MeasuresPage.test.tsx`, `measures.spec.ts` | Cumple |
| FR-010 (sin juicios ni comparaciones) | `measures.test.ts` (lista de términos prohibidos); no hay gráficos ni diferencias | Cumple |
| FR-011 (privacidad) | `body_measurements.test.sql`, `measures.spec.ts` (token de otra cuenta por la API real) | Cumple |
| FR-012 (borrador y guardado no confirmado) | `MeasuresPage.test.tsx`, `measures.spec.ts` | Cumple |
| FR-013 (accesibilidad) | `measures.spec.ts` (axe) | Cumple |
| FR-015 (último peso en el inicio) | `measures.spec.ts` | Cumple |

Hallazgos corregidos al probar: el formulario reutilizaba la misma solicitud para guardados sucesivos (el segundo guardado devolvía el primero) y las tarjetas de medidas tenían un nombre accesible que no contenía su texto visible.

Suite: `npm run typecheck`, lint, format, Vitest (88 archivos, 1 050 pruebas), pgTAP (49 archivos, 1 317 pruebas) y e2e de medidas e inicio en verde.
