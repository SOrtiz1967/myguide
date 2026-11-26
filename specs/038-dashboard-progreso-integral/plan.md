# Plan de implementación: Dashboard de progreso integral

**Rama**: `038-dashboard-progreso-integral` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Una pantalla de lectura que **no calcula ni guarda nada propio**: reúne, para un período de 7, 30 o 90 días, los resultados que ya producen las specs anteriores (entrenamiento 032, 033, 035 y 031; nutrición 026, 027 y 010; recuperación 007 y 034; evolución 008, 019 y 020) y los muestra en cuatro bloques con un resumen y una lectura neutral. Cada bloque funciona por separado: si una spec de origen no está disponible, el bloque se omite sin dejar huecos. No hay tablas ni funciones nuevas; el costo está en coordinar lecturas y mantener la coherencia con las pantallas de detalle.

## Contexto técnico

- **Base de datos**: ninguna migración. Se usan las lecturas existentes (`trends_nutrition`, `trends_training_sets`, `muscle_volume`, `adherence_weeks`, `exercise_records`, `session_checks`, mediciones y actividad). Si el tiempo de carga excede el objetivo con un año de datos, se evalúa una función agregadora `dashboard_summary(from, to)` de solo lectura en una spec posterior; el diseño lo deja abierto.
- **Aplicación**: `app/src/features/dashboard/` con `useDashboardData(period)` (carga en paralelo con TanStack Query y tolera fallos por bloque), módulos puros por bloque (`trainingBlock.ts`, `nutritionBlock.ts`, `recoveryBlock.ts`, `evolutionBlock.ts`), `summary.ts` (resumen y lectura), `DashboardPage` (ruta `/progreso`) y componentes de bloque con gráficos y alternativa textual. Se enlaza desde el menú y desde «Hoy».
- **Pruebas**: Vitest para cada bloque y el resumen con datos armados a mano (con y sin datos, períodos incompletos, módulos ausentes) y revisión de textos; Playwright para el recorrido (cambio de período, navegación al detalle) y accesibilidad; prueba de coherencia entre un indicador del dashboard y su pantalla de detalle.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: solo lee datos propios a través de lecturas que ya verifican dueño y sesión; ningún dato sale a servicios externos; las fotos se muestran como referencia sin análisis. |
| II | Se cumple: todo es derivado; no se guarda ni se completa nada. |
| III | Se cumple: los indicadores nutricionales conservan su rango e incertidumbre y la distinción entre estimado y confirmado. |
| IV | Se cumple: lectura neutral, sin culpa, sin presión por cumplir metas. |
| V | Se cumple: cada métrica con unidad, período, cantidad de registros y fuente; sin conclusiones con una sola medición; sin causalidad; períodos incompletos indicados. |
| VI | Se cumple: gráficos con tabla alternativa, 360 px, accesible por teclado. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Composición, no duplicación.** Cada bloque llama a la misma función pura que usa su pantalla de detalle. Un indicador nunca se vuelve a calcular con otra lógica; así las pruebas de coherencia son directas.
- **Degradación por bloque.** Cada bloque declara sus dependencias y se muestra solo si las lecturas respondieron; un error en un bloque no tumba la pantalla (estado de error con reintento por bloque).
- **Períodos.** 7, 30 y 90 días terminando hoy en la zona de la persona; el período se guarda en la URL (`?periodo=30`) para volver desde el detalle conservándolo.
- **Resumen y lectura.** `summary.ts` arma el resumen («Peso: estable. Entrenamiento: 12/13 sesiones…») con plantillas y la lectura solo si hay datos suficientes en al menos dos bloques. Lenguaje descriptivo: «mientras», «al mismo tiempo»; nunca «porque», «gracias a» ni «debido a».
- **Peso «estable».** Se usa el promedio móvil de 7 días de la spec 020: «estable» si la variación entre los extremos del período está dentro de un umbral documentado (±0,5 % del peso para 30 días; ver `research.md`); con menos de 3 pesajes, «sin datos suficientes».
- **Fotos.** Se muestran solo como enlace a la comparación de la spec 019 y la cantidad en el período; no se muestran en el dashboard ni se interpretan.
- **Fuente.** Pasos y sueño muestran manual o integración (hoy solo manual).
- **Carga.** Las lecturas se piden en paralelo con un solo `useQueries`; objetivo de menos de 3 segundos con un año de datos.

## Contratos

Sin funciones nuevas. Las lecturas usadas se listan en `data-model.md`.

## Estructura de archivos

```text
app/src/features/dashboard/{useDashboardData,summary,period,config}.ts(x)
app/src/features/dashboard/blocks/{trainingBlock,nutritionBlock,recoveryBlock,evolutionBlock}.ts
app/src/features/dashboard/{DashboardPage,PeriodSelector,BlockCard,SummaryHeader,MetricRow}.tsx
app/src/components/AppShell.tsx
app/src/routes/index.tsx
app/src/copy/es.ts
app/tests/{unit/blocks.*.test.ts,unit/summary.test.ts,component/DashboardPage.test.tsx,e2e/dashboard.spec.ts}
```

## Verificación

lint, formato, typecheck, Vitest completo y Playwright del dashboard y accesibilidad. Prueba de coherencia: cada indicador coincide con su pantalla de detalle en el mismo período. Revisión de textos: sin lenguaje causal.
