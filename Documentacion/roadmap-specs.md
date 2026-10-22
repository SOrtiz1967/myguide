# Roadmap de specs — Fitness Tracking App

Basado en la Constitution v1.2.1. Este documento solo define el corte y el contenido previsto de cada spec; ninguna spec está escrita todavía.

**Contexto del MVP:** el MVP lo usa solo el autor. Las reglas de privacidad y autenticación de la Constitution se mantienen igual. Lo que se pospone es el trabajo orientado a usuarios externos (ver spec 011).

**Orden de implementación:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011. La spec 012 (gráficos de progreso de entrenamiento) está redactada pero se desarrolla recién después de la 006 y cuando el autor lo decida; su número respeta el final del roadmap.

## Ola 1: base

### 001 — Cuentas, perfil y base de la PWA
- Registro, inicio y cierre de sesión.
- Perfil: edad, sexo, altura, zona horaria, unidades métricas.
- Modelo de propiedad de registros (cada registro pertenece a una cuenta).
- Esqueleto de PWA: instalable, mensaje sin conexión, borradores locales que se borran al cerrar sesión.
- Estados de carga, vacío, éxito y error.
- Las decisiones técnicas pendientes #1 y #2 (framework, backend, auth, base de datos, almacenamiento) se resuelven en el plan de esta spec.
- Principios: I, VI, VII, VIII.

## Ola 2: registro manual (el producto funciona sin IA)

### 002 — Catálogo de alimentos
- Importación de alimentos genéricos y de marca a una copia local.
- Búsqueda, alimentos propios, copia editable de uno del catálogo.
- Procedencia por ítem, valores por 100 g/ml, valores faltantes visibles.
- Decisión pendiente #4: fuentes, licencias, cobertura para Argentina.
- Principios: II, III, X.
- **Estado (2026-10-19): implementada.** Fuentes: Open Food Facts (ODbL 1.0, ≈3.900 productos utilizables de Argentina) y USDA FoodData Central (CC0, genéricos). Cobertura medida: solo ≈26 % de los productos de Argentina de Open Food Facts tiene energía y macronutrientes, por eso los alimentos propios y las copias editables pesan más. Pendientes del autor: cargar USDA (traducción de nombres), carga en producción y revisión legal de la ODbL antes de abrir la aplicación (T077, T078). Resultados en [`specs/002-catalogo-de-alimentos/research.md`](../specs/002-catalogo-de-alimentos/research.md).

### 003 — Registro de comidas
- Registro por texto o por catálogo, foto opcional.
- Estados manual, estimado y confirmado; snapshots de macros; idempotencia.
- Regla del día: imputar comidas pasada la medianoche al día en curso.
- Principios: II, III, VI.
- **Estado (2026-10-19): implementada** (verificación final en curso). Ítems con instantánea inmutable y origen visible, regla del día (el día que se cierra), repetir una comida y foto opcional privada con limpieza de metadatos en el servidor. Mediciones y decisiones en [`specs/003-registro-de-comidas/research.md`](../specs/003-registro-de-comidas/research.md). Pendiente: al construir la eliminación de cuentas hay que borrar también los archivos de `meal-photos/<user_id>/`.

### 004 — Objetivo calórico y resumen diario
- Objetivo configurable y calorías restantes, con incertidumbre explícita.
- Mensajes neutrales al superar el objetivo, sin lenguaje culpabilizante.
- Principios: IV.
- **Estado (2026-10-20): implementada y verificada.** Historial de solo altas del objetivo (cada día conserva el que regía), tarjeta «Objetivo del día» en la vista del día, restante «como máximo» cuando faltan datos de energía, estimados sin confirmar aparte, frase neutral al superar el objetivo y nota informativa por debajo de 1.200 kcal (rango 1.000 a 6.000). Corrige además un defecto heredado: la caché de consultas ya no se comparte entre cuentas en una misma pestaña. Decisiones y mediciones en [`specs/004-objetivo-calorico-resumen/research.md`](../specs/004-objetivo-calorico-resumen/research.md).
- **Queda fuera a propósito (para la spec 007/008):** una referencia calórica sugerida o calculadora de mantenimiento; el perfil no guarda peso y el método necesita ser documentado y revisable (Principio V).

### 005 — Catálogo de ejercicios
- Importación de ejercicios a una copia local, traducción revisable al español.
- Ejercicios propios, copia editable, tipo de medición.
- Decisión pendiente #4 (parte de ejercicios): fuentes y licencias.
- Principios: II, X.
- **Estado (2026-10-21): implementada y verificada.** Catálogo local de 897 ejercicios en español (876 de free-exercise-db, de dominio público, con traducción automática sin revisar, y 21 propios de MyGuide en CC0), búsqueda sin acentos por nombre, nombre original o sinónimo, filtros por músculo y equipamiento, ejercicios propios, copia editable, editar y eliminar, y pantalla de fuentes. Con 20.000 filas la búsqueda responde en menos de 60 ms. Decisiones y mediciones en [`specs/005-catalogo-de-ejercicios/research.md`](../specs/005-catalogo-de-ejercicios/research.md).
- **Para la spec 006:** cada ejercicio tiene un `id` (uuid) que no cambia nunca; la sesión debe **copiar** el nombre y el tipo de medición (`reps_weight`, `reps_bodyweight`, `duration`, `distance_duration`) en su propio registro y no depender de la fila del ejercicio, porque un ejercicio propio se puede editar o eliminar. La referencia al ejercicio en la sesión no debe borrar ni bloquear nada (`on delete set null` o sin clave foránea). El selector de ejercicios puede reutilizar `search_exercises`.
- **Queda fuera a propósito:** imágenes y videos, dificultad y mecánica, calorías por ejercicio (spec 007/008), recomendaciones automáticas.
- **Pendiente del autor** (en [`Documentacion/issues-autor/08-ejercicios-licencias.md`](issues-autor/08-ejercicios-licencias.md)): confirmar la procedencia de los pasos de free-exercise-db antes de abrir la aplicación a terceros, la dedicación CC0 de `myguide-base` y la carga en producción.

### 006 — Rutinas, calendario y sesiones
- Rutina planificada, sesión realizada, modificada, reprogramada y cancelada.
- Registro de ejercicios, series, repeticiones, cargas, esfuerzo percibido, sustituciones y notas.
- Mover sesiones sin perder historial ni duplicar; snapshots de ejercicios.
- Persistencia de borrador de una sesión activa.
- Principios: II, V, VI.
- **Estado (2026-10-21): implementada y verificada** (`specs/006-rutinas-calendario-sesiones/`, ver su `verification.md`). Decisiones del autor: las rutinas son un catálogo de entrenamientos sin días asignados ni repetición automática (cada día se elige cuál toca), el esfuerzo percibido es uno por ejercicio de la sesión (para todas sus series en conjunto) y los gráficos quedan fuera. Deja lista la lectura `exercise_history` y las copias de nombre y tipo de medición que usará la spec 012 (gráficos de progreso de entrenamiento).

### 007 — Sueño, pasos y actividad
- Registro manual con fuente y fecha.
- Datos faltantes mostrados como faltantes; sin sumar fuentes distintas.
- Decisión pendiente #5: viabilidad de integraciones en una PWA (el registro manual es la base).
- Principios: V.

### 008 — Peso, medidas y fotos de progreso
- Mediciones con unidad y fecha.
- Subida de fotos: eliminación de EXIF, compresión, almacenamiento privado y cifrado en reposo.
- Comparación visual por fecha, sin IA.
- Principios: I, V, VI.

## Ola 3: inteligencia y cierre

### 009 — Estimación de comidas con IA
- Adaptador de proveedor desacoplado, validación de esquema en ejecución.
- Fallo del proveedor cae al registro manual; idempotencia y control de cuota.
- Solo fotos y textos de comidas; nunca fotos de progreso.
- Decisiones pendientes #3 y #6.
- Principios: I, II, III, VII, IX.

### 010 — Tendencias, mantenimiento y correlaciones
- Gráficos comparativos con unidades y fechas.
- Calorías de mantenimiento con umbral mínimo de datos y método explicado.
- Patrones entre sueño, rendimiento y alimentación, sin causalidad.
- Decisión pendiente #8.
- Principios: IV, V.

### 011 — Privacidad y ciclo de vida de los datos
- Exportación, eliminación de registros y de cuenta, retención de copias de seguridad.
- Plazo de retención de logs y herramienta de monitoreo.
- Decisiones pendientes #7 y #9.
- Obligatoria antes de publicar con usuarios reales; no bloquea el uso personal del MVP.
- Principios: I, IX.

### 012 — Gráficos de progreso de entrenamiento
- Evolución de un ejercicio por sesión (medidas según su tipo de medición), elección de período y comparación de dos períodos, con unidades, fechas y cantidad de datos.
- Resumen de sesiones realizadas por semana y por mes, sin metas ni rachas.
- Sin conclusiones firmes a partir de una sola sesión; datos faltantes como faltantes; sin recomendaciones.
- Depende de la 006. Comparte lenguaje visual con los gráficos de la 010, pero esta spec solo trata de entrenamiento.
- Principios: II, IV, V, VI.
- **Estado (2026-10-21): especificada (`specs/012-graficos-progreso-entrenamiento/spec.md`) y dejada para después**, sin rama ni plan.

## Notas de la spec 001 (cerrada el 2026-10-17)

- **Confirmación de correo:** es no bloqueante solo por ser un MVP. Antes de abrir la aplicación a otras personas debe reevaluarse si pasa a ser obligatoria.
- **Registro abierto:** la spec 011 (privacidad y ciclo de vida de los datos) es **obligatoria antes de publicar**.
- **Pendientes de la spec 001:** prueba de envío real de correo (T009), refuerzo opcional con Auth Hook (T031) y despliegue inicial (T077).
- Verificación y revisión de seguridad: `specs/001-cuentas-perfil-pwa/verification.md`.
