# Investigación: Perfil de atleta

## Decisión 1: extender el perfil, no duplicarlo

**Decisión**: la spec 014 es dueña de sexo, nacimiento, altura, objetivo principal, experiencia, trabajo y días. Esta spec solo agrega lo que falta.
**Alternativas descartadas**: perfil separado (duplica datos) y rehacer el onboarding (arriesga lo ya verificado).

## Decisión 2: vigencia por filas

**Decisión**: historial de filas inmutables para objetivos y disponibilidad, como `energy_goals` (spec 004).
**Razón**: Principio II. El patrón ya está probado y su resolución («fila más reciente con `effective_from <= D`») es una función pura del cliente.

## Decisión 3: objetivos soportados y mapeo

Los ocho objetivos del documento de origen son un catálogo fijo en el código, no una tabla. Solo tres tienen equivalente en `profiles.goal_type`; el resto se guarda sin alterar el cálculo calórico. Cambiar el principal no cambia el objetivo calórico vigente (FR-009).

## Decisión 4: preferencias como sugerencias

Las preferencias nunca se aplican como filtros obligatorios en otras specs; cada spec consumidora las usa como punto de partida (FR-008).

## Decisión 5: unidades

Se mantienen kg y cm; no hay selector de unidades en esta spec.

## Preguntas que se resuelven al implementar

- Límite de preferencias por persona (propuesta: 50 favoritos, 50 evitados, 100 alimentos evitados).
- Lista cerrada de equipamiento (propuesta: barra, mancuernas, máquinas, poleas, bandas, peso corporal, kettlebell, otro).
