# Implementation Plan: Catálogo de ejercicios

**Branch**: `005-catalogo-de-ejercicios` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-catalogo-de-ejercicios/spec.md`

## Summary

Un catálogo de ejercicios propio y de solo lectura (fuerza, peso corporal, movilidad, resistencia y deporte) más ejercicios privados de cada cuenta, con búsqueda sin acentos que encuentra por nombre en español, nombre original y sinónimos; filtros por músculo y equipamiento; copias editables; procedencia visible; datos faltantes mostrados como «sin dato»; y un tipo de medición por ejercicio que define cómo se registrará en las sesiones de la spec 006.

Enfoque técnico (detalle y alternativas en [research.md](research.md)): la misma estructura que el catálogo de alimentos (spec 002): una tabla `exercises` con RLS (catálogo común con `user_id` nulo, y ejercicios propios), `exercise_sources` para las licencias, búsqueda con `unaccent` y `pg_trgm`, y funciones SQL atómicas para crear, editar y copiar. El catálogo se carga con un **pipeline del autor** (Deno) desde **free-exercise-db** (876 ejercicios, Unlicense, versión y SHA-256 fijados) y una fuente propia **myguide-base** (≈ 20 ejercicios de resistencia y deporte, CC0). Los nombres y pasos se traducen **una sola vez, de forma asistida**, a un archivo versionado y revisable con estado por texto; el tipo de medición sale de reglas documentadas más un archivo de excepciones.

Cierra la decisión técnica pendiente **#4 de la Constitution** para ejercicios. wger (CC BY-SA, 645 traducciones al español) se evaluó y se descartó por sus obligaciones de atribución por ejercicio y de compartir igual; queda como complemento posible en una spec futura.

## Technical Context

**Language/Version**: TypeScript estricto (frontend y pipeline de carga con Deno), SQL (Postgres 17 de Supabase)

**Primary Dependencies**: las de las specs 001 a 004; en la base, las extensiones `unaccent` y `pg_trgm` ya instaladas por la spec 002. Ninguna dependencia nueva de frontend ni del pipeline.

**Storage**: Postgres de Supabase (`exercises`, `exercise_sources`, `private.exercise_import_runs`). El catálogo ocupa del orden de 2 MB (≈ 900 ejercicios): presupuesto de diseño 10 MB de los 500 MB del plan gratuito. Sin archivos ni imágenes.

**Testing**: pgTAP (RLS, funciones, restricciones, listas cerradas, solo lectura del catálogo, guardián de claves foráneas), Deno (normalización, reglas de medición, traducciones y carga), Vitest + Testing Library (búsqueda, filtros, formulario, detalle, fuentes), Playwright + axe (flujos, accesibilidad, responsive, aislamiento por la API real)

**Target Platform**: la misma PWA de la spec 001

**Project Type**: aplicación web (frontend SPA + backend gestionado) más un proceso de carga que ejecuta el autor

**Performance Goals**: el 95 % de las búsquedas, con o sin filtros, responde en menos de 1 s con 2.000 ejercicios (SC-002); la primera tanda son 20 resultados. Se verifica además con 20.000 filas sintéticas para tener margen.

**Constraints**: sin servicios de terceros en la búsqueda y la consulta; los datos faltantes nunca se completan con supuestos; el catálogo no es editable desde la aplicación; sin imágenes; un tipo de medición obligatorio por ejercicio.

**Scale/Scope**: ≈ 900 ejercicios del catálogo; ejercicios propios de una persona (decenas); 5 pantallas nuevas o ampliadas (búsqueda, detalle, formulario, edición, fuentes).

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).* Evaluado contra la Constitution v1.2.1.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | Los ejercicios propios son privados con RLS y pruebas de aislamiento entre cuentas; el catálogo es de solo lectura para cuentas con sesión vigente; las altas y los cambios pasan solo por funciones que verifican la sesión; las funciones de carga solo son ejecutables por `service_role`, cuya clave vive solo en el entorno del autor (`supabase/.env`). Sin fotos, sin proveedores de IA en ejecución. | ✅ Cumple |
| **II. Integridad e idempotencia** | Creación y copia idempotentes (`client_request_id`); `based_on_exercise_id` con `on delete set null`; un `id` estable por ejercicio y una prueba guardiana que prohíbe `on delete cascade` hacia `exercises`, para que las sesiones de la spec 006 guarden una copia del nombre y del tipo de medición y editar o borrar nunca reescriba el pasado. | ✅ Cumple |
| **III. Estimaciones transparentes** | No hay estimaciones. Los datos faltantes (músculos, equipamiento, descripción) se guardan vacíos y se muestran como «sin dato»; el equipamiento ausente no se confunde con «peso corporal». | ✅ Cumple |
| **IV. Información de salud responsable** | No hay recomendaciones, calorías ni objetivos: solo descripción de ejercicios. Los pasos no se reescriben con consejos propios. | ✅ No aplica |
| **V. Seguimiento consistente** | El tipo de medición por ejercicio es la base de que la spec 006 registre series, cargas y tiempos de forma consistente. | ✅ Cumple |
| **VI. Experiencia** | Responsive, español, estados definidos, borradores locales y guardado confirmado reutilizados de la spec 001; la búsqueda y la consulta no dependen de integraciones externas; sin conexión no se busca ni se guarda y se informa. | ✅ Cumple |
| **VII. Arquitectura** | Normalización de la carga pura y probada; la base reimpone las validaciones del cliente; listas cerradas verificadas entre cliente y base; sin dependencias nuevas. | ✅ Cumple |
| **VIII. Calidad y SDD** | Spec con criterios comprobables; TDD en cada tarea; 32 escenarios en `quickstart.md`; riesgos de licencia, traducción y clasificación identificados antes de implementar. | ✅ Cumple |
| **IX. Observabilidad** | La carga registra solo identificadores de la fuente y motivos de omisión; ningún registro contiene el contenido de los ejercicios propios; el informe se guarda en `private.exercise_import_runs`. | ✅ Cumple |
| **X. Catálogos de referencia** | Copia local importada; procedencia por ejercicio (fuente, identificador, fecha, origen); licencia y atribución registradas y exigidas antes de importar, y documentadas en `Documentacion/fuentes-datos.md`; ejercicios propios y copias; faltantes visibles; nombres y descripciones en español con estado de traducción revisable, y revisión de la licencia de las fuentes como tarea del autor. | ✅ Cumple, con un riesgo documentado (procedencia de los pasos de la fuente, `research.md` Decisión 2) |
| **Decisiones pendientes** | Se cierra la #4 para ejercicios; las #3, #5 a #9 siguen pendientes. | ✅ |

**Resultado**: sin violaciones. El riesgo de procedencia de los textos de free-exercise-db queda registrado, con mitigación en el diseño (la descripción es separable) y una tarea para el autor.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado. El guardián `rls_guardrail` (spec 001) se amplía con `exercise_sources` en la lista de tablas de referencia de solo lectura y sigue exigiendo RLS y políticas sin llamadas sueltas a `is_session_fresh()` en `exercises`.

## Project Structure

### Documentation (this feature)

```text
specs/005-catalogo-de-ejercicios/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-api.md      # funciones RPC y acceso a tablas
│   ├── import-pipeline.md   # formato intermedio y reglas de la carga
│   └── ui-routes.md         # rutas, estados y accesibilidad
├── checklists/requirements.md
└── tasks.md                 # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/src/features/exercises/
├── api.ts                   # llamadas a search_exercises, create_exercise, update_exercise, copy_exercise y borrado
├── schema.ts                # validación Zod (mismas reglas que la base)
├── exerciseLists.ts         # listas cerradas de músculos, equipamiento y tipos de medición, con su español
├── exerciseText.ts          # funciones puras: explicación del tipo, etiquetas, procedencia, pasos numerados
├── useExerciseSearch.ts     # búsqueda con retardo, pestañas, filtros y tandas
├── ExerciseSearchPage.tsx
├── ExerciseDetailPage.tsx
├── ExerciseForm.tsx         # alta y edición
├── ExerciseCreatePage.tsx · ExerciseEditPage.tsx
├── ExerciseFilters.tsx      # músculo y equipamiento, con etiquetas que se quitan
└── useExercise.ts
app/src/features/foods/SourcesPage.tsx   # pasa a mostrar «Alimentos» y «Ejercicios»
app/src/components/AppShell.tsx          # enlace «Ejercicios»
app/src/copy/es.ts                       # clave `exercises`
app/src/routes/index.tsx                 # rutas /ejercicios
app/tests/{unit,component,e2e}/

supabase/migrations/         # tablas, RLS, funciones (prefijo 20261021…)
supabase/tests/              # pgTAP del catálogo de ejercicios
supabase/seed.sql            # ayudantes tests.create_exercise / tests.create_catalog_exercise (solo local)
supabase/import/
├── extract-exercises.ts · extract-exercises-base.ts
├── normalize-exercises.ts   # puro y probado
├── load-exercises.ts
└── data/
    ├── ejercicios-es.json         # traducciones (estado por texto)
    ├── ejercicios-medicion.csv    # excepciones al tipo de medición
    ├── ejercicios-base.json       # fuente propia myguide-base (CC0)
    └── ejercicios-muestra.ndjson  # muestra para desarrollo y pruebas
Documentacion/fuentes-datos.md             # se agrega la sección de ejercicios
Documentacion/issues-autor/08-ejercicios-licencias.md   # tareas del autor
```

**Structure Decision**: se agrega `features/exercises` junto a `features/foods` y se amplía `supabase/import/` con los archivos de ejercicios. Se reutilizan tal cual `OriginTabs`, `Field`, `ConfirmDialog`, `useDraft`, `saveRemotely` y `newRequestId`; solo se extraen a un lugar común las piezas de `features/foods` que se usan en dos sitios (pestañas de origen y procedencia).

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `exercises` con `user_id` nulo para el catálogo (excepción a la convención de la spec 001, igual que `foods`) | Un único modelo y una única búsqueda para catálogo y ejercicios propios; las copias y la spec 006 los tratan por igual | Dos tablas duplican la búsqueda y la lógica de copia |
| `exercise_sources` sin `user_id` (tabla de referencia de solo lectura) | Información común de fuentes y licencias | Forzar `user_id` no tiene sentido; se agrega a la lista explícita del guardián |
| Músculos y alias en arreglos `text[]` con restricciones | Se leen siempre junto con el ejercicio; mantiene atómicas crear, editar y copiar | Tablas de unión: más joins y más funciones para listas de menos de 10 elementos |
| Una segunda fuente propia (`myguide-base`) | La fuente externa casi no cubre resistencia ni deportes | Dejar solo free-exercise-db obliga a cada persona a crear natación, caminata y correr |

## Riesgos y verificaciones previas a implementar

1. **Procedencia de los pasos de free-exercise-db** (`research.md`, Decisión 2): revisión del autor antes de abrir la aplicación a terceros; la descripción es separable.
2. **Volumen y calidad de la traducción**: ≈ 880 nombres y 3.000 frases; una prueba verifica que todo ejercicio importado tiene traducción y que el archivo no mezcla inglés sin marcar.
3. **Clasificación del tipo de medición**: ≈ 110 casos dudosos que se resuelven a mano en `ejercicios-medicion.csv`.
4. **Búsqueda con alias, filtros y 20.000 filas** (prototipo): si no llega a 1 s, se ajusta el índice.
5. **Listas cerradas entre cliente y base**: una prueba verifica que coinciden.
6. **Pruebas dependientes del catálogo local**: las pruebas pgTAP empiezan con `delete from public.exercises` dentro de su transacción (lección de las specs 002 y 003).
7. **Pantalla de fuentes compartida**: cambia una pantalla de la spec 002; sus pruebas se actualizan en la misma tarea.
