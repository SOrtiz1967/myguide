# Implementation Plan: Objetivo calórico y resumen diario

**Branch**: `004-objetivo-calorico-resumen` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-objetivo-calorico-resumen/spec.md`

## Summary

La persona fija, cambia y quita un objetivo de energía diaria (kcal). Con objetivo, la vista del día de la spec 003 muestra una tarjeta con el objetivo, lo registrado, lo que resta y la cuenta que lo explica, separando lo estimado sin confirmar y marcando los ítems sin dato de energía para no presentar la cifra como exacta. Si se supera el objetivo, se informa la diferencia con una frase neutral, sin sugerencias ni estilo de alarma. Sin objetivo, no se muestra nada del objetivo. Cada día conserva el objetivo que regía ese día.

Enfoque técnico (detalle y alternativas en [research.md](research.md)):

- Una tabla `energy_goals` de **solo altas**: cada cambio (o el quitar el objetivo) es una fila; el objetivo de un día es el último cambio guardado que ya regía ese día.
- Escritura por la función `set_energy_goal`, idempotente por `request_id`, que fija el día de vigencia con el "hoy" del servidor.
- El historial se trae entero en una consulta y el objetivo de cada día se resuelve en el cliente con una función pura (navegar entre días no agrega pedidos).
- El resumen del día es otra función pura sobre los ítems que la vista del día ya trae.
- Todos los textos en un solo lugar (`copy/es.ts`, clave `goal`) y una prueba con una lista de términos prohibidos (Principio IV).
- Corrección heredada: el `AuthProvider` vacía la caché de consultas al cerrar sesión o cambiar de cuenta, para que el objetivo (y los ítems y fotos de las specs anteriores) de una cuenta no se vea desde otra en la misma pestaña.

No hay dependencias nuevas, Edge Functions ni servicios externos.

## Technical Context

**Language/Version**: TypeScript estricto (frontend), SQL (Postgres 17 de Supabase)

**Primary Dependencies**: las de las specs 001 a 003. Ninguna nueva.

**Storage**: Postgres (`energy_goals`); sin archivos. El historial es de unas pocas filas por año.

**Testing**:

- pgTAP: la función con hora simulada y distintas zonas, idempotencia (incluido el reintento tardío), rango, RLS y aislamiento entre cuentas, cascada al eliminar la cuenta.
- Vitest y Testing Library: `goalOn`, `summarizeDay` (casos de tabla), lectura del número, formulario del objetivo, tarjeta del día en cada estado, lista de términos prohibidos.
- Playwright y axe: los 31 escenarios del quickstart, accesibilidad, responsive y aislamiento por la API real.

**Target Platform**: la misma PWA (navegadores modernos)

**Project Type**: aplicación web (SPA y backend gestionado)

**Performance Goals**: la vista de un día con 60 ítems y objetivo sigue cargando completa en menos de 2 s (SC-002); fijar el objetivo en 3 interacciones y menos de 20 s (SC-001). El resumen es un cálculo en memoria sobre datos que ya están cargados.

**Constraints**:

- Cada día conserva su objetivo: el historial es de solo altas.
- Un faltante nunca es 0; el restante es un máximo cuando faltan datos.
- Sin objetivo no existe ningún elemento del objetivo en pantalla.
- Nada se ajusta ni se sugiere automáticamente.
- Sin conexión no se guarda.
- Sin referencia calórica sugerida (el perfil no tiene peso).

**Scale/Scope**: una persona; 1 pantalla nueva, 1 tarjeta nueva en una pantalla existente, 1 tabla y 1 función.

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).* Evaluado contra la Constitution v1.2.1.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | El objetivo es un dato de salud: tabla con RLS por dueño y sesión vigente, sin escritura directa del cliente, `anon` sin permisos y prueba de aislamiento. Sin servicios de terceros ni registros técnicos con el valor. Se borra en cascada con la cuenta. La caché de consultas del navegador se vacía al cerrar sesión o cambiar de cuenta (corrige un defecto heredado, `research.md`, Decisión 9). | ✅ Cumple |
| **II. Integridad e idempotencia** | Historial de solo altas: un cambio nunca reescribe un día pasado. `set_energy_goal` es idempotente por `request_id`, también ante un reintento tardío. El día de vigencia lo fija el servidor con la zona horaria del perfil, no el reloj del dispositivo. | ✅ Cumple |
| **III. Estimaciones transparentes** | El restante se calcula con una cuenta visible; los ítems sin dato no se tratan como 0 (el restante pasa a ser "como máximo"); lo estimado sin confirmar se muestra aparte. Sin precisión de más: kcal enteras. | ✅ Cumple |
| **IV. Información de salud responsable** | Calorías restantes y progreso solo con objetivo configurado. Al superarlo: frase factual y neutral, sin sugerencias ni alarma, verificada con una lista de términos prohibidos en tres capas de prueba. El objetivo nunca se ajusta solo y se puede revisar y quitar. Sin rachas. Rango de 1.000 a 6.000 kcal y nota informativa por debajo de 1.200, con recomendación de consultar a un profesional sin diagnosticar. No hay recomendaciones automáticas. | ✅ Cumple |
| **V. Seguimiento consistente** | No aplica a esta spec. Se deja fuera a propósito la referencia calórica de mantenimiento (necesita peso y un método documentado y revisable). | ✅ No aplica |
| **VI. Experiencia** | Pocos pasos (3 interacciones), responsive, en español, estados de carga, vacío, éxito y error, borrador local, guardado confirmado. El estado no depende solo del color. Sin conexión no se guarda. | ✅ Cumple |
| **VII. Arquitectura** | Cálculos puros y probados (`goalOn`, `summarizeDay`, lectura del número); la base reimpone el rango; sin dependencias nuevas. | ✅ Cumple |
| **VIII. Calidad y SDD** | TDD en cada tarea; 31 escenarios en `quickstart.md`; riesgos de hora, orden del historial y lenguaje verificados antes de dar la spec por terminada. | ✅ Cumple |
| **IX. Observabilidad** | Sin Edge Function ni registro técnico nuevo; ningún registro contiene el objetivo. | ✅ Cumple |
| **X. Catálogos** | No aplica: esta spec no toca los catálogos. | ✅ No aplica |

**Resultado**: sin violaciones.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado. El guardián `rls_guardrail` (spec 001) cubre la tabla sin cambios porque tiene `user_id`, RLS y una política con la sesión evaluada una vez. La prueba de rendimiento de políticas de la spec 002 también la cubre.

## Project Structure

### Documentation (this feature)

```text
specs/004-objetivo-calorico-resumen/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-api.md      # tabla, función de escritura y lectura del historial
│   └── ui-routes.md         # ruta, tarjeta, textos y estados
├── checklists/requirements.md
└── tasks.md                 # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/src/features/goals/
├── api.ts                   # leer el historial, set_energy_goal (fijar y quitar)
├── schema.ts                # leer el número (miles, coma, entero) y el rango 1.000-6.000
├── goalHistory.ts           # funciones puras: goalOn(historial, día), "vigente desde"
├── daySummary.ts            # función pura: summarizeDay(ítems, objetivo)
├── useGoalHistory.ts        # consulta del historial (caché compartida entre días)
├── GoalSummary.tsx          # la tarjeta "Objetivo del día" y "Cómo se calcula"
├── GoalPage.tsx             # /objetivo: valor vigente, formulario, quitar
└── LowGoalNote.tsx          # nota informativa (< 1.200 kcal)
app/src/features/meals/DayPage.tsx   # incluye GoalSummary arriba del total del día
app/src/features/auth/AuthProvider.tsx   # vacía la caché de consultas al cerrar sesión o cambiar de cuenta
app/src/copy/es.ts                   # clave `goal` (todos los textos en un lugar)
app/src/routes/index.tsx             # ruta /objetivo
app/tests/{unit,component,e2e}/
app/tests/support/forbiddenTerms.ts  # lista de términos prohibidos (Principio IV)

supabase/migrations/         # energy_goals, RLS y set_energy_goal
supabase/tests/              # pgTAP de energy_goals
supabase/seed.sql            # ayudante tests.create_energy_goal (solo local)
```

**Structure Decision**: se agrega `features/goals` al frontend, junto a `features/meals`, y una tabla y una función al backend. La tarjeta se monta dentro de `DayPage` con una sola línea; el total del día de la spec 003 no cambia. La lectura de números reutiliza el estilo de `features/foods/nutrition.ts`; el borrador, `lib/useDraft`; los guardados, `lib/mutation` (`saveRemotely`) e `lib/ids` (`newRequestId`).

## Complexity Tracking

Sin desviaciones: no hay proyectos nuevos, bibliotecas ni patrones nuevos. La única decisión no obvia (un historial de solo altas con resolución en el cliente, en lugar de una columna en el perfil) está justificada por el Principio II en `research.md`, Decisiones 1 a 3.

## Riesgos y verificaciones previas a implementar

1. **Hora y zona** (research, Decisión 2): el día de vigencia se prueba con hora simulada y varias zonas, incluido un cambio a la 01:00 en el día que se cierra y un cambio de zona del perfil.
2. **Orden del historial** (Decisión 1): cambios del mismo día, una zona que retrocede y un reintento tardío; gana el último guardado y el reintento no pisa nada.
3. **Rendimiento**: con 60 ítems el resumen no agrega más de unos milisegundos (se mide en la verificación final).
4. **Lenguaje** (Decisión 5): la lista de términos prohibidos se aplica a todos los textos en las tres capas. La lista es una red de seguridad: la revisión del texto sigue siendo humana.
5. **Dato de salud**: la caché de consultas se vacía al cerrar sesión o cambiar de cuenta (Decisión 9), y se verifica con una prueba de componente y una e2e con dos cuentas en la misma pestaña; además se revisa que ningún registro técnico ni mensaje de error exponga el valor.
