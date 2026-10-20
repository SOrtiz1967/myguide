# Research: Objetivo calórico y resumen diario

**Feature**: 004-objetivo-calorico-resumen | **Fecha**: 2026-10-19

Decisiones técnicas de la spec 004. Se apoyan en el stack de las specs 001 a 003 (Vite + React + TanStack Query, Supabase con RLS) y en los ítems de la spec 003, de los que sale todo el cálculo. No hay Edge Functions, bibliotecas ni servicios nuevos.

## Decisión 1: un historial de cambios, solo de altas

- **Decisión**: una tabla `public.energy_goals` donde cada **cambio** del objetivo es una fila nueva (no se actualiza ni se borra ninguna):
  - `kcal` entero entre 1.000 y 6.000, o **nulo** cuando la persona quita el objetivo;
  - `effective_from`: el día (en la zona horaria de la persona) desde el que rige;
  - `created_at`: cuándo se guardó;
  - `client_request_id`, único por cuenta.
  
  El objetivo de un día `D` es el `kcal` de la fila **más reciente por `created_at`** entre las que tienen `effective_from <= D`. Si no hay filas, o la más reciente tiene `kcal` nulo, ese día no tiene objetivo.
- **Por qué**: cumple el Principio II por diseño. Cambiar el objetivo agrega una fila y nunca reescribe lo que regía en un día pasado (FR-008, SC-004). Quitar el objetivo es otra fila (con `kcal` nulo), así que el historial sigue siendo uno solo y los días anteriores a quitarlo conservan el suyo (FR-010). Los dos cambios del mismo día se resuelven solos: gana el último guardado (FR-009). Los días anteriores a la primera fila no tienen objetivo (FR-010).
- **Por qué `created_at` y no `effective_from` para ordenar**: si la zona horaria del perfil cambia hacia atrás, hoy puede ser un día anterior al `effective_from` de un cambio ya guardado. Ordenar por `created_at` hace que "gana el último guardado" siga valiendo en cualquier caso; ordenar por `effective_from` dejaría ganar a un cambio más viejo.
- **Alternativas**: una columna `daily_goal_kcal` en `profiles` (reescribe el pasado: viola el Principio II y mezcla responsabilidades con la spec 001); guardar el objetivo vigente **dentro de cada día** (obliga a crear filas de días que nadie registró y no sirve para una fecha futura); una fila por (cuenta, día) con `upsert` (pierde el orden entre cambios del mismo día y no permite que un reintento viejo sea inofensivo, ver la Decisión 2).

## Decisión 2: una función de escritura, idempotente, con el "hoy" del servidor

- **Decisión**: el cliente no inserta directamente. `set_energy_goal(kcal, request_id, client_timezone)` es `security definer` (con `search_path` vacío), exige `auth.uid()` y `private.is_session_fresh()` y:
  1. si ya existe una fila de esa cuenta con ese `request_id`, la devuelve sin hacer nada;
  2. valida `kcal` (nulo, o entero de 1.000 a 6.000);
  3. calcula `effective_from` como el "hoy" de la persona con la misma función que la spec 003 (`private.log_day_status_at` con `private.effective_timezone`);
  4. inserta la fila.
  
  La lógica real vive en `private.set_energy_goal_at(usuario, kcal, request_id, ahora, zona)`, sin permiso para el cliente, para probarla con una hora simulada (el mismo patrón que `log_day_status_at`).
- **Por qué**: el día lo decide el servidor, no el reloj del dispositivo (FR-008). La idempotencia por `request_id` hace que un doble clic o un reintento no agreguen filas (FR-006, SC-006), **incluso si el reintento llega tarde, después de otro cambio**: la fila original sigue ahí con su identificador, así que el reintento solo la devuelve y no pisa el cambio posterior. Con un `upsert` por día eso no se podría garantizar.
- **Regla de "hoy"**: el cambio rige desde el día calendario de hoy en la zona del perfil, aunque se esté registrando el día que se cierra (spec 003). Es la lectura natural de "rige desde hoy" y está en los Supuestos de la spec.
- **Alternativas**: `insert` directo con política RLS (el cliente podría elegir `effective_from` y reescribir el pasado); pasar la fecha desde el cliente (confía en el reloj del dispositivo).

## Decisión 3: el objetivo de cada día se resuelve en el cliente

- **Decisión**: el cliente trae **todo el historial** de la cuenta con una sola consulta (`select` con RLS, ordenado por `created_at`) y una función pura `goalOn(history, day)` resuelve el objetivo de cualquier día. La consulta se guarda en caché y se comparte entre días.
- **Por qué**: navegar entre días no agrega ningún pedido de red (el requisito de rendimiento de SC-002 se mantiene) y la regla queda en una función pura, probada con casos de tabla, como los totales de la spec 003. El historial es minúsculo: unas pocas filas por año, así que traerlo entero cuesta menos que una consulta por día. Se pone un tope defensivo de 1.000 filas en la consulta.
- **Qué no se duplica**: la lectura de "el objetivo de un día" no tiene una versión en SQL. Si más adelante otra función del servidor la necesitara (por ejemplo, un resumen semanal en la spec 008), se agrega allí con una prueba que verifique que coincide con la del cliente.
- **Alternativas**: una función SQL `energy_goal_on(day)` llamada por día (una consulta más por cada día que se ve; duplica la regla si después se calcula también en el cliente); guardar el objetivo resuelto en cada ítem (acopla las dos specs y reescribe filas).

## Decisión 4: el resumen del día es una función pura sobre los ítems de la spec 003

- **Decisión**: `summarizeDay(entries, goal)` recibe los ítems del día (los mismos que ya trae la vista del día) y el objetivo, y devuelve:
  - `registered`: la suma de `energy_kcal` de los ítems **con dato**, **redondeada una vez** a kcal enteras;
  - `pending`: la parte de `registered` que viene de ítems con `status = 'pending'` (estimados sin confirmar), redondeada una vez;
  - `missing`: cuántos ítems tienen la energía en `null` (un `0` cuenta como dato);
  - con objetivo: `remaining = goal − registered` (negativo si se superó, y en ese caso `difference = −remaining`), `percent = round(registered / goal × 100)` y un estado `under`, `met` u `over`;
  - sin objetivo: solo `registered`, `pending` y `missing`; **ninguno** de los campos del objetivo existe (FR-002, SC-009).
- **Redondeo**: se suma primero y se redondea después, y la cuenta que se muestra usa el total **ya redondeado** ("2.000 − 1.350 = 650"), de modo que la cuenta visible siempre cierra con las cifras que se ven (SC-003). Es la misma suma que el total de energía de la vista del día (spec 003), así que ambos números coinciden.
- **Ítems estimados**: se cuentan **dentro** de lo registrado y su parte se muestra aparte (FR-016). La alternativa de excluirlos subestimaría lo registrado; la de mezclarlos sin decirlo no cumpliría el Principio IV. Hoy nunca hay ítems `pending` en el uso real (los traerá la spec 009), pero el cálculo y la presentación ya los separan y las pruebas los siembran.
- **Ítems sin dato**: `registered` es entonces un **mínimo** y `remaining` un **máximo** ("restan como máximo"); si además se superó, la diferencia es "al menos" esa cifra. Los textos salen de estos estados (ver `contracts/ui-routes.md`).
- **Alternativas**: calcular el resumen en el servidor (otra función y otro pedido por día, sin ventaja); tratar `null` como 0 (viola el Principio III).

## Decisión 5: lenguaje neutral, verificado por una lista de términos

- **Decisión**: todos los textos del objetivo y del resumen viven en `copy/es.ts` bajo una sola clave (`goal`) y una prueba unitaria recorre **todos** esos textos (las cadenas y las funciones de texto, llamadas con valores de ejemplo para cada estado) buscando una lista de términos prohibidos. La misma lista se usa en la prueba de componente y en la e2e sobre el texto renderizado de la pantalla en el estado "superado" (SC-005).
- **Lista inicial de términos** (sin acentos y sin importar mayúsculas, como raíces): `ayun`, `saltar`, `saltea`, `compens`, `quemar`, `quema`, `ejercicio`, `entren`, `culpa`, `fall`, `excedi`, `exceso`, `pasaste`, `pasarte`, `mal `, `malo`, `prohib`, `castig`, `engord`, `limit`, `restring`, `dieta`, `deber`, `tenes que`, `tienes que`, `hay que`. Se mantiene en `app/tests/support/forbiddenTerms.ts` y se puede ampliar.
- **Por qué**: el Principio IV pide que esto sea verificable. Una lista es una red de seguridad, no una prueba de que el texto sea bueno: la revisión del texto sigue siendo humana (se revisa en el PR) y la lista solo evita que una frase equivocada llegue por descuido.
- **Frases base** (revisables; la versión vigente está en el contrato de la interfaz): "Registraste 250 kcal más que el objetivo de este día.", "Restan 650 kcal." y "Restan 0 kcal. Lo registrado coincide con el objetivo.".
- **Estilo**: el estado "superado" usa los mismos colores neutros que los demás: ni el color de error (`danger`), ni íconos de advertencia, ni cambios de peso tipográfico. La barra llega al 100 % y no cambia (FR-020).
- **Alternativas**: dejar los textos en los componentes (imposible de revisar en conjunto); una lista blanca de frases (frágil y no detecta frases nuevas).

## Decisión 6: pantallas y rutas

- **Decisión**: una ruta nueva `/objetivo` (privada) con el formulario del objetivo, y una tarjeta **"Objetivo del día"** (`GoalSummary`) en la vista del día de la spec 003, justo arriba del total del día.
  - Sin objetivo: la tarjeta muestra solo lo registrado y un enlace discreto "Fijar un objetivo de energía (opcional)". No se muestra barra, porcentaje ni restantes, ni siquiera vacíos (SC-009).
  - Con objetivo: objetivo, registrado, restantes, la cuenta, el porcentaje como texto, la barra (decorativa, `aria-hidden`: lo dicho en texto es lo que importa) y un desplegable "Cómo se calcula".
  - El formulario muestra el valor vigente y desde cuándo rige (`desde` es el `effective_from` de la primera fila de la racha de filas consecutivas con ese mismo valor, para que guardar el mismo valor otra vez no "mueva" la fecha), un campo numérico y "Quitar objetivo" con confirmación.
- **Por qué no una pestaña ni un enlace de cabecera**: el objetivo se consulta y se toca desde el día; agregar un tercer elemento a una cabecera ya con cuatro enlaces no ayuda y empuja a mirar el objetivo a quien no lo usa.
- **Alternativas**: dentro de `/perfil` (mezcla un dato que cambia con los datos casi fijos del perfil); modal en la vista del día (peor para borradores y accesibilidad).

## Decisión 7: validación y borrador

- **Decisión**: el valor se lee con una regla única, en este orden:
  1. si tiene la forma de un entero con punto de miles (`2.000`, `1.250`, `12.000`), los puntos son separadores de miles;
  2. si no, se acepta un número con coma o punto decimal (`2000`, `2000,0`, `1800.5`);
  3. el resultado debe ser un **entero**: `1800,5` y `1.5` se rechazan con un mensaje que dice que el objetivo se escribe en kcal enteras. `2000,0` vale 2000.
  
  Textos, vacíos, negativos y notación científica se rechazan. Los límites (1.000 a 6.000) se verifican en Zod, se reimponen en la función y con un `check` de la tabla. El borrador del formulario usa `useDraft` (spec 001) con el identificador `energy-goal` y se borra al guardar o al cerrar sesión. La regla se prueba con casos de tabla (`app/tests/unit`).
- **Nota informativa**: por debajo de 1.200 kcal se guarda igual y se muestra la nota, tanto después de guardar como siempre que se vea el objetivo guardado y en el resumen (FR-005).

## Decisión 8: privacidad y registros técnicos

- **Decisión**: la tabla sigue la convención de propiedad de la spec 001 (`user_id`, RLS, política de lectura con `(select auth.uid())` y `(select private.is_session_fresh())`). El cliente solo lee. No hay Edge Function ni registro técnico propio; las llamadas a la función no se registran con su contenido, y ningún mensaje de error del servidor se muestra tal cual (`saveRemotely` ya lo evita).
- **Por qué**: el objetivo es un dato de salud (FR-023). El guardián `rls_guardrail` de la spec 001 cubre la tabla sin cambios.
- **Eliminar la cuenta**: `on delete cascade` borra el objetivo y su historial (FR-028); no hay archivos externos (a diferencia de las fotos de la spec 003).

## Decisión 9: vaciar la caché de consultas al cambiar de sesión

- **Hallazgo**: la aplicación usa un único `QueryClient` global (`main.tsx`) que nunca se vacía, y las claves de caché (`['meals', 'day', fecha]`, el historial del objetivo, etc.) no incluyen la cuenta. Si una persona cierra sesión y otra entra en la misma pestaña sin recargar, TanStack Query muestra primero lo guardado en caché (obsoleto) y recién después trae lo nuevo: la segunda cuenta vería por un instante comidas, fotos firmadas y, con esta spec, el objetivo de la primera. Es un defecto heredado de las specs 002 y 003 que esta spec no puede dejar pasar porque agrega un dato de salud (FR-029).
- **Decisión**: el `AuthProvider` vacía la caché (`queryClient.clear()`) cada vez que la sesión pasa a cerrada (`SIGNED_OUT`, sesión vencida) y cada vez que el usuario de la sesión cambia (`SIGNED_IN` con otro `user.id`). No se cambian las claves de caché.
- **Por qué**: es el arreglo más pequeño que cierra el problema para todas las funcionalidades, presentes y futuras, en un solo lugar. Cambiar las claves obligaría a tocar cada consulta y es fácil de olvidar en las siguientes specs.
- **Verificación**: prueba de componente del `AuthProvider` (la caché queda vacía tras cerrar sesión y tras cambiar de usuario) y una e2e con dos cuentas en la misma pestaña (la segunda no ve datos de la primera, ni siquiera durante la carga).
- **Alternativas**: poner el `user.id` en todas las claves (invasivo y propenso a olvidos); recargar la página al cerrar sesión (parpadeo, pierde estado y no cubre el cambio de cuenta por vencimiento).

## Decisión 10: qué se deja fuera, a propósito

- **Referencia calórica sugerida**: no. El perfil no guarda peso y la fórmula de mantenimiento necesita peso y un método documentado y revisable (Principio V); eso es de la spec 007/008. Esta spec solo registra el valor que la persona elige.
- **Objetivo por tipo de día, por día de la semana o de macronutrientes**: no (Supuestos de la spec).
- **Resumen en la pantalla de inicio o por semana**: no; vive en la vista del día.
- **Avisos o recordatorios de que se superó el objetivo**: no. Nada se dispara por superar el objetivo (FR-022).

## Riesgos y verificaciones previas a implementar

1. **Hora y zona**: el "hoy" que fija `effective_from` se prueba con una hora simulada y distintas zonas (incluido el cambio de zona del perfil y una escritura a la 01:00 en el día que se cierra).
2. **Orden del historial**: una prueba con cambios en el mismo día, con una zona que retrocede y con un reintento tardío, para confirmar que gana el último guardado y que el reintento no pisa nada.
3. **Rendimiento**: el resumen se calcula sobre los ítems que la vista del día ya trae; se mide con 60 ítems que no agrega más de unos milisegundos a la carga (SC-002).
4. **Lenguaje**: la lista de términos prohibidos se aplica a todo el texto del objetivo y del resumen en las tres capas de prueba.
