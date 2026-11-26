# MyGuide: resumen de la aplicación

Actualizado el 2026-11-25. Este documento resume de qué trata la aplicación, cómo funciona y qué se hizo hasta ahora. El detalle de cada funcionalidad está en `specs/NNN-*/`, y el estado fino en el `README.md` de la raíz.

## 1. De qué se trata

MyGuide es una aplicación web personal (PWA instalable, solo en español, multiusuario, con conexión obligatoria) para registrar y analizar:

- alimentación,
- entrenamiento,
- sueño, pasos y actividad diaria,
- evolución física (peso, medidas y fotos de progreso).

Su objetivo es que el usuario entienda sus tendencias y tome decisiones informadas. Dos reglas la distinguen y vienen de la Constitution del proyecto (v1.2.2, `.specify/memory/constitution.md`):

- **No presenta estimaciones como certezas.** Los cálculos de calorías, el mantenimiento estimado y las estimaciones con IA muestran su rango, su método y sus sesgos. La IA propone y el usuario revisa y confirma.
- **No fomenta conductas perjudiciales.** El lenguaje no es coercitivo y hay avisos ante objetivos calóricos muy bajos.

También son principios permanentes la privacidad (datos y fotos privados, sin secretos en el frontend, exportación y eliminación de datos) y el control del usuario sobre sus propios registros.

## 2. Qué puede hacer el usuario

| Área | Rutas | Qué ofrece |
| ---- | ----- | ---------- |
| Cuenta y perfil | `/registro`, `/ingresar`, `/recuperar`, `/perfil` | Registro con captcha y confirmación de correo no bloqueante, ingreso, recuperación de contraseña, perfil y zona horaria. |
| Primer ingreso | `/bienvenida`, `/plan` | Onboarding con el objetivo físico y propuesta de calorías diarias. |
| Inicio «Hoy» | `/` | Semana, panel del día, calorías, entrenamiento, últimos registros y recordatorios. |
| Alimentos | `/alimentos`, `/fuentes` | Catálogo local de alimentos con búsqueda, procedencia y licencias. Se pueden crear, copiar y editar alimentos propios. |
| Comidas | `/comidas/:fecha` | Registro por día y por comida: elegir alimento, cantidad, porciones, alimento manual, repetir una comida y adjuntar foto. |
| Estimación con IA | dentro de Comidas | Describir la comida en texto o foto, revisar y confirmar. También calcula un alimento escrito a mano. |
| Objetivo calórico | `/objetivo` | Objetivo diario con historial, resumen del día y aviso si es muy bajo. |
| Ejercicios | `/ejercicios` | Catálogo con búsqueda y filtros, ejercicios propios, historial y evolución por ejercicio. |
| Entrenamiento | `/entrenamiento` | Rutinas, plan semanal, sesiones (series, repeticiones y pesos), marcar como completado y resumen de actividad. |
| Sueño, pasos y actividad | `/actividad` | Registro manual. |
| Peso y medidas | `/medidas` | Peso con gráfico y promedio de 7 días, períodos, peso en ayunas opcional y medidas corporales. |
| Fotos de progreso | `/fotos` | Subir fotos (sin metadatos), verlas por fecha y compararlas de a dos. |
| Suplementos | `/suplementos` | Lista propia y marcas «Tomado» / «Sin registro» en el inicio. |
| Recordatorios | dentro de la app | Avisos de peso, fotos y suplementos con frecuencia configurable. |
| Tendencias | `/tendencias` | Alimentación por semana, mantenimiento estimado (con rango, método y sesgos) y entrenamiento junto al sueño. No muestra correlaciones. |
| Privacidad | `/privacidad` | «Tus datos»: descarga de datos y fotos, y eliminación de la cuenta con sus archivos. |

## 3. Cómo funciona

### Arquitectura

```text
Navegador (PWA React)  ──►  Supabase
                              ├─ Auth (con captcha Turnstile y SMTP de Brevo)
                              ├─ Postgres con RLS (cada usuario ve solo lo suyo)
                              ├─ Storage privado (meal-photos, progress-photos)
                              └─ Edge Functions (Deno): register, confirm-email,
                                 send-verification, request-password-reset,
                                 delete-account, meal-photo, progress-photo,
                                 estimate-meal (llama a Gemini)
```

- **Frontend** (`app/`): Vite, React y TypeScript. El código se organiza por funcionalidad en `app/src/features/*`. Los componentes compartidos están en `app/src/components`, los textos en `app/src/copy/es.ts` y las rutas en `app/src/routes`. El diseño visual es la dirección «Bloques», con tema negro y azul, menú lateral y barra inferior.
- **Backend como código** (`supabase/`): unas 60 migraciones SQL con tablas, políticas RLS y funciones de base de datos (`search_foods`, `add_meal_entry`, `log_day`, `set_energy_goal`, `save_session`, etc.), más las Edge Functions.
- **Seguridad:** las claves (Gemini, Brevo, service role) viven solo en las funciones. Los buckets son privados. Las fotos de progreso nunca se envían a la IA. Solo las fotos de comidas pueden ir a Gemini, y es opcional.
- **Catálogos:** alimentos desde Open Food Facts (Argentina) y USDA FoodData Central. Ejercicios desde free-exercise-db y una base propia. Se cargan con scripts de Deno (`npm run import:*`) que ejecuta el autor, no la app. Buscar no depende de servicios de terceros.
- **Costo:** todo corre en planes gratuitos (Supabase Free, Cloudflare Pages, Brevo, Turnstile y Gemini con límites). La guía está en `Documentacion/despliegue.md`.

### Metodología

El proyecto sigue Spec-Driven Development con Spec Kit. Cada funcionalidad es una carpeta `specs/NNN-nombre/` con `spec`, `plan`, `research`, modelo de datos, contratos, `tasks` y `verification`. El plan general está en `Documentacion/roadmap-specs.md`.

### Verificación

Una funcionalidad no se da por terminada hasta que pasan:

- formato, lint y tipos (`npm run format:check`, `lint` y `typecheck` con `--prefix app`),
- pruebas de unidad y componentes (`npm test --prefix app`),
- pruebas de extremo a extremo con Playwright (`npm run e2e --prefix app`),
- pruebas de base de datos con pgTAP (`npm run test:db`),
- pruebas de Edge Functions (`npm run test:functions`),
- pruebas de la carga del catálogo (`npm run test:import`),
- invariantes de configuración (`npm run test:config`),
- ausencia de secretos en el bundle (`npm run check:secrets --prefix app`).

La suite e2e completa pasa **292 de 292** (2026-11-06). Hay CI en GitHub Actions.

## 4. Lo hecho

Todas estas specs están implementadas y verificadas:

| Spec | Tema |
| ---- | ---- |
| 001 | Cuentas, perfil y base de la PWA |
| 002 | Catálogo de alimentos |
| 003 | Registro de comidas (con foto) |
| 004 | Objetivo calórico y resumen diario |
| 005 | Catálogo de ejercicios |
| 006 | Rutinas, calendario y sesiones |
| 007 | Sueño, pasos y actividad (registro manual) |
| 008 | Peso y medidas |
| 009 | Estimación de comidas con IA (Gemini) |
| 010 | Tendencias |
| 011 | Privacidad y ciclo de vida de los datos |
| 012 | Gráficos de progreso de entrenamiento |
| 013 | Inicio «Hoy» |
| 014 | Primer ingreso y objetivo físico |
| 015 | Cálculo de calorías diarias |
| 016 | Rediseño con semana en el inicio |
| 017 | Rediseño de la interfaz («Bloques») |
| 018 | Plan semanal y pestaña Entrenamiento |
| 019 | Fotos de progreso |
| 020 | Evolución del peso |
| 021 | Recordatorios configurables |
| 022 | Suplementación |

Trabajo reciente:

- Constitution 1.2.2, CI en GitHub Actions y ajuste del adaptador de Gemini.
- Suite e2e completa en verde, con corrección de tests desactualizados por los rediseños.
- Corrección del aviso al eliminar la cuenta.
- Investigación de fuentes para ampliar el catálogo (spec 023).

## 5. Pendiente

**Despliegue y pruebas reales** (el código está listo, falta el paso externo):

- Desplegar a producción: Supabase, funciones, buckets y Cloudflare Pages (001 T077).
- Probar el envío real de correo (001 T009).
- Cargar los genéricos de USDA (traducción de nombres) y el catálogo en producción (002).
- Probar una foto real de teléfono (003).
- Cargar los ejercicios en producción y revisar las licencias del autor de free-exercise-db (005).
- Probar con la clave real de Gemini (009).
- Confirmar los plazos de retención del plan de Supabase (011).

**Specs abiertas:**

- **023, ampliación del catálogo de alimentos.** La investigación se hizo y no hay fuentes nuevas con licencia clara. Faltan terminar las cargas (issues 02, 04 y 05) y pedir permiso a ARGENFOODS (issue 09). Ver `Documentacion/issues-autor`.
- **024, notificaciones push.** Feature futuro que depende de la 021 (hoy los recordatorios son solo dentro de la app).
