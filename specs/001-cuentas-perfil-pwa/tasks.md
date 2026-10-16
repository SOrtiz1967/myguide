---

description: "Lista de tareas de la spec 001: cuentas, perfil y base de la PWA"
---

# Tasks: Cuentas, perfil y base de la PWA

**Input**: documentos de diseño en `/specs/001-cuentas-perfil-pwa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`backend-api.md`, `ui-routes.md`), quickstart.md

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o escenario del `quickstart.md` que verifica.

**Organization**: tareas agrupadas por historia de usuario. Skills del proyecto aplicables: `database-design` (migraciones y RLS), `frontend-design` (interfaz), `systematic-debugging` (fallos), `security-review` (cierre).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US4)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/`, pruebas en `app/tests/{unit,component,e2e}/`
- Backend: `supabase/migrations/`, `supabase/functions/`, `supabase/tests/` (pgTAP)
- Documentación: `Documentacion/` y `specs/001-cuentas-perfil-pwa/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: estructura del proyecto y herramientas

- [ ] T001 Crear el proyecto Vite + React + TypeScript en `app/` con `strict: true` en `app/tsconfig.json`
- [ ] T002 [P] Instalar dependencias de ejecución en `app/package.json`: `react-router`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@supabase/supabase-js`, `tailwindcss`, `vite-plugin-pwa` (fijar versiones y confirmar `app/package-lock.json`)
- [ ] T003 [P] Instalar dependencias de desarrollo en `app/package.json`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `prettier`
- [ ] T004 [P] Configurar ESLint y Prettier en `app/eslint.config.js` y `app/.prettierrc`, y los scripts `format:check`, `lint`, `typecheck`, `test`, `e2e` en `app/package.json` (comandos documentados en `quickstart.md`)
- [ ] T005 Inicializar Supabase con `npx supabase init` y configurar `supabase/config.toml` según `contracts/backend-api.md`: confirmación nativa de correo desactivada, contraseña mínima de 10 caracteres, captcha Turnstile activado, cambio de correo deshabilitado, límites de intentos conservadores
- [ ] T006 [P] Crear `app/.env.example` solo con variables públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`) y ampliar `.gitignore` con `app/.env.local`, `supabase/.env`, `node_modules/`, `dist/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestructura que DEBE estar lista antes de cualquier historia

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Prototipos de riesgo (resultados documentados en `research.md`)

- [ ] T007 Prototipo del riesgo #1: con Supabase local, verificar que el JWT de un inicio de sesión con contraseña incluye `amr` con método y hora, y que se conserva al renovar el token. Registrar resultado y decisión (aplicar vencimiento en base de datos, o respaldo solo en cliente) en `specs/001-cuentas-perfil-pwa/research.md`, sección "Resultados de prototipos"
- [ ] T008 [P] Prototipo del riesgo #2: comprobar si el Auth Hook de envío de correo está disponible en el plan gratuito y si permite descartar correos de recuperación. Registrar decisión (hook o función `request-password-reset`) en `specs/001-cuentas-perfil-pwa/research.md`
- [ ] T009 [P] Prototipo del riesgo #3 (requiere acción del autor): crear la cuenta del proveedor SMTP gratuito y el sitio de Turnstile, enviar un correo de prueba y revisar entregabilidad. Registrar cuota vigente y resultado en `specs/001-cuentas-perfil-pwa/research.md`

### Base de datos (usar la skill `database-design`)

- [ ] T010 Migración `supabase/migrations/20261016000100_profiles_table.sql`: crear `public.profiles` con las columnas de `data-model.md` (`user_id` PK referencia a `auth.users` con borrado en cascada, `birth_date date`, `sex text`, `height_cm numeric(4,1)`, `timezone text`, `unit_system text not null default 'metric'`, `privacy_notice_version text not null`, `privacy_notice_accepted_at timestamptz not null`, `email_verified_at timestamptz`, `last_active_at timestamptz not null`, `created_at`, `updated_at`), disparador de `updated_at` y **RLS activado sin políticas** (acceso denegado por defecto)
- [ ] T011 Migración `supabase/migrations/20261016000200_email_verification_tokens.sql`: crear esquema `private` y `private.email_verification_tokens` (`id uuid PK`, `user_id uuid not null` en cascada, `token_hash text not null unique`, `expires_at timestamptz not null`, `used_at timestamptz`, `created_at`), con RLS activado y `revoke all` para `anon` y `authenticated`
- [ ] T012 Migración `supabase/migrations/20261016000300_signup_profile_trigger.sql`: disparador sobre `auth.users` que crea el perfil tomando `privacy_notice_version` de los metadatos del alta; si falta, el alta **falla**; `on conflict do nothing` para ser idempotente

### Base del frontend

- [ ] T013 Cliente único de Supabase en `app/src/lib/supabase.ts` que valida con Zod las variables `VITE_*` al arrancar y falla con un mensaje claro si falta alguna
- [ ] T014 [P] Escribir primero las pruebas de componentes de estados en `app/tests/component/states.test.tsx` (carga, vacío, éxito, error con roles y etiquetas accesibles, FR-023); verificar que fallan
- [ ] T015 [P] Implementar `LoadingState`, `EmptyState`, `SuccessMessage` y `ErrorState` en `app/src/components/` para que pasen las pruebas de T014
- [ ] T016 [P] Layout mobile-first y tokens de diseño (paleta, tipografía, espaciado) en `app/src/components/AppShell.tsx` y la configuración de Tailwind, aplicando la skill `frontend-design`; foco visible y respeto de `prefers-reduced-motion`
- [ ] T017 [P] Textos en español centralizados en `app/src/copy/es.ts` y mapeador de errores en `app/src/lib/errors.ts` con pruebas en `app/tests/unit/errors.test.ts`: los errores de credenciales y de recuperación usan **un único mensaje uniforme** que no revela si un correo existe (FR-005)
- [ ] T018 Proveedores y tabla de rutas de `contracts/ui-routes.md` (React Router, TanStack Query) en `app/src/main.tsx` y `app/src/routes/index.tsx`, con páginas provisionales para cada ruta
- [ ] T019 Ayudantes pgTAP en `supabase/tests/00_helpers.sql`: crear dos usuarios de prueba (A y B) con perfil, suplantar a cada uno y fijar `last_active_at`
- [ ] T020 [P] Escribir primero `supabase/functions/_shared/log.test.ts`: el registrador **elimina** correos, tokens y contraseñas de cualquier mensaje o campo (Principio IX); verificar que falla
- [ ] T021 [P] Implementar `supabase/functions/_shared/log.ts` (registro estructurado sin datos personales), y las utilidades compartidas `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/admin.ts` (cliente con clave de servicio, solo servidor) y `supabase/functions/_shared/mail.ts` (envío por SMTP configurado con variables de entorno)

**Checkpoint**: base lista. Las historias pueden comenzar.

---

## Phase 3: User Story 1 - Crear una cuenta e iniciar sesión (Priority: P1) 🎯 MVP

**Goal**: registro con aviso de privacidad, inicio y cierre de sesión con vencimiento a 30 días de inactividad, recuperación de contraseña, cambio de contraseña y confirmación de correo no bloqueante.

**Independent Test**: escenarios 1 a 6, 15 y 16 del `quickstart.md`.

### Tests for User Story 1 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T022 [P] [US1] Prueba pgTAP en `supabase/tests/profiles_signup.test.sql`: el alta sin `privacy_notice_version` falla; con ella crea exactamente un perfil con versión y fecha de aceptación; repetir el alta no duplica (FR-007, FR-029)
- [ ] T023 [P] [US1] Prueba pgTAP en `supabase/tests/session_expiry.test.sql`: `private.is_session_fresh()` es falsa con `last_active_at` de hace 31 días y verdadera con 29; `touch_session()` devuelve `session_expired` pasados 30 días; `start_session()` rechaza un token cuyo `amr` de contraseña no es reciente (FR-003)
- [ ] T024 [P] [US1] Pruebas Deno en `supabase/functions/send-verification/index.test.ts` y `supabase/functions/confirm-email/index.test.ts`: reenvío bloqueado antes de 60 s (`429`), `409` si ya está confirmado, token vence a las 24 h, token de un solo uso, solo se guarda el hash, redirección idéntica para vencido, usado e inexistente (FR-026)
- [ ] T025 [P] [US1] Pruebas de componentes de registro en `app/tests/component/RegisterForm.test.tsx`: casilla del aviso obligatoria (FR-029), contraseña de mínimo 10 y máximo 72 caracteres (FR-002), botón deshabilitado durante el envío para evitar doble alta (FR-007), mensaje neutral ante correo ya registrado
- [ ] T026 [P] [US1] Pruebas de componentes en `app/tests/component/auth-forms.test.tsx` para ingreso, recuperación, restablecimiento y cambio de contraseña: error de credenciales uniforme (FR-005), respuesta neutral de recuperación, contraseña actual incorrecta rechazada (FR-028)
- [ ] T027 [P] [US1] Prueba de extremo a extremo en `app/tests/e2e/auth.spec.ts` contra Supabase local y su buzón de correo: registro, banner de correo sin confirmar, recuperación **sin correo** si no está confirmado, confirmación, recuperación con correo, cierre de todas las sesiones, cambio de contraseña que cierra las demás (escenarios 1 a 6 y 16)

### Implementation for User Story 1

- [ ] T028 [US1] Migración `supabase/migrations/20261016000400_session_expiry.sql` según el resultado de T007: `private.is_session_fresh()` (verdadera si `last_active_at` es de hace menos de 30 días), `public.touch_session()` y `public.start_session()` (solo si el `amr` de contraseña es reciente), aplicando la skill `database-design`
- [ ] T029 [P] [US1] Edge Function `supabase/functions/send-verification/index.ts`: autenticada; invalida tokens pendientes, crea uno de 24 h guardando solo su hash, envía el enlace; `429` y `409` según `contracts/backend-api.md`
- [ ] T030 [P] [US1] Edge Function `supabase/functions/confirm-email/index.ts`: valida hash, vigencia y uso único; marca `used_at` y `profiles.email_verified_at`; redirige a `/correo-confirmado` o `/correo-no-valido` sin distinguir causas
- [ ] T031 [US1] Bloqueo de recuperación para correos sin confirmar (FR-027) según el resultado de T008: Auth Hook en `supabase/config.toml` y su función, o `supabase/functions/request-password-reset/index.ts` con respuesta `202` uniforme
- [ ] T032 [P] [US1] Esquemas Zod de los formularios en `app/src/features/auth/schemas.ts` (correo, contraseña de 10 a 72 caracteres)
- [ ] T033 [P] [US1] API de autenticación en `app/src/features/auth/api.ts`: registro con metadato `privacy_notice_version`, inicio de sesión seguido de `start_session()`, cierre de sesión, cambio de contraseña con la actual (FR-028) y cierre de las demás sesiones (FR-030), recuperación y restablecimiento con cierre de todas las sesiones (FR-030)
- [ ] T034 [US1] `AuthProvider` en `app/src/features/auth/AuthProvider.tsx`: llama a `touch_session()` al abrir la aplicación y al renovar el token; ante `session_expired` cierra la sesión local y redirige a ingresar
- [ ] T035 [P] [US1] Widget de Turnstile en `app/src/features/auth/TurnstileWidget.tsx`
- [ ] T036 [P] [US1] Texto del aviso de privacidad y su constante de versión en `app/src/copy/privacy-notice.ts` (resumen breve en español de qué datos se guardan y cómo se protegen)
- [ ] T037 [US1] Páginas de registro, ingreso, recuperación y restablecimiento en `app/src/features/auth/pages/` (`RegisterPage.tsx`, `LoginPage.tsx`, `RecoverPage.tsx`, `ResetPage.tsx`) con los cuatro estados de `contracts/ui-routes.md`
- [ ] T038 [US1] Banner de correo sin confirmar con "Reenviar enlace" en `app/src/features/auth/VerifyEmailBanner.tsx` y páginas `/correo-confirmado` y `/correo-no-valido` en `app/src/features/auth/pages/`
- [ ] T039 [US1] Formulario de cambio de contraseña en `app/src/features/auth/ChangePasswordForm.tsx`
- [ ] T040 [US1] Conectar las rutas públicas de la historia en `app/src/routes/index.tsx`
- [ ] T041 [US1] Documentar la configuración de SMTP y Turnstile (variables de entorno y secretos de servidor, sin valores) en `supabase/README.md`

**Checkpoint**: se puede registrar, ingresar, salir, recuperar y cambiar la contraseña. Pasan T022 a T027.

---

## Phase 4: User Story 2 - Mis datos son solo míos (Priority: P1)

**Goal**: aislamiento por propietario aplicado en la base de datos, sesión fresca exigida en cada acceso, y rutas privadas protegidas.

**Independent Test**: escenarios 7, 8 y 15 del `quickstart.md`.

### Tests for User Story 2 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T042 [P] [US2] Prueba pgTAP en `supabase/tests/profiles_rls.test.sql`: B no lee ni modifica el perfil de A; `anon` no accede; el cliente no puede `insert` ni `delete`; no puede modificar `user_id`, `email_verified_at`, `privacy_notice_*` ni `last_active_at`; una fila ajena se ve como inexistente (FR-009 a FR-011)
- [ ] T043 [P] [US2] Prueba pgTAP en `supabase/tests/rls_session_fresh.test.sql`: con `last_active_at` de hace 31 días, `select` y `update` sobre el propio perfil devuelven cero filas (FR-003, FR-010)
- [ ] T044 [P] [US2] Prueba pgTAP en `supabase/tests/private_tokens.test.sql`: `anon` y `authenticated` no pueden leer ni escribir `private.email_verification_tokens`
- [ ] T045 [P] [US2] Prueba pgTAP guardiana en `supabase/tests/rls_guardrail.test.sql`: falla si alguna tabla del esquema `public` no tiene RLS activado o carece de políticas basadas en `user_id = auth.uid()`; protege a las specs 002 a 011
- [ ] T046 [P] [US2] Pruebas en `app/tests/component/RequireAuth.test.tsx` y `app/tests/e2e/access.spec.ts`: una ruta privada sin sesión redirige a `/ingresar` sin pedir datos (FR-012)

### Implementation for User Story 2

- [ ] T047 [US2] Migración `supabase/migrations/20261016000500_profiles_rls.sql`: políticas `select` y `update` del propio perfil con `user_id = auth.uid()` y `private.is_session_fresh()`; privilegios por columna para que el cliente solo actualice `birth_date`, `sex`, `height_cm` y `timezone`; sin políticas de `insert` ni `delete`
- [ ] T048 [US2] Migración `supabase/migrations/20261016000510_private_schema_grants.sql`: revocar a `anon` y `authenticated` el acceso al esquema `private` y a sus objetos, y otorgar solo lo necesario a las funciones públicas
- [ ] T049 [US2] Guarda de rutas privadas en `app/src/routes/RequireAuth.tsx` y aplicarla en `app/src/routes/index.tsx`
- [ ] T050 [US2] Documentar la convención de propiedad (checklist de nueva tabla, plantilla de políticas y de pruebas) en `supabase/README.md`, enlazando `data-model.md`, para las specs 002 a 011

**Checkpoint**: el aislamiento y la caducidad de sesión se hacen cumplir en la base de datos. Pasan T042 a T046.

---

## Phase 5: User Story 3 - Configurar mi perfil (Priority: P2)

**Goal**: ver y editar fecha de nacimiento, sexo opcional, altura y zona horaria con validación y unidades.

**Independent Test**: escenarios 9 a 11 del `quickstart.md`. **Depende de US2** (políticas de lectura y escritura del perfil).

### Tests for User Story 3 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T051 [P] [US3] Pruebas unitarias en `app/tests/unit/profileSchema.test.ts`: fecha de nacimiento no futura y no anterior a 120 años atrás, altura entre 50 y 250, sexo `female`, `male` o nulo, zona horaria IANA válida (FR-014)
- [ ] T052 [P] [US3] Prueba pgTAP en `supabase/tests/profiles_constraints.test.sql`: se rechazan los valores fuera de rango y `unit_system` distinto de `metric`
- [ ] T053 [P] [US3] Pruebas de componentes en `app/tests/component/ProfileForm.test.tsx`: altura mostrada con "cm", sexo opcional con la opción "Prefiero no indicarlo", dato sin informar mostrado como "No informado" y nunca con valor supuesto (FR-017), la zona horaria del dispositivo se sugiere pero no se aplica sola (FR-016)
- [ ] T054 [P] [US3] Prueba de extremo a extremo en `app/tests/e2e/profile.spec.ts`: completar el perfil, recargar y ver los valores persistidos con su unidad (escenarios 9 a 11)

### Implementation for User Story 3

- [ ] T055 [US3] Migración `supabase/migrations/20261016000600_profiles_constraints.sql` con las restricciones literales: `birth_date` no futura y no anterior a 120 años atrás; `sex` en (`female`, `male`) o nulo; `height_cm` entre 50 y 250; `timezone` nombre IANA válido; `unit_system = 'metric'`
- [ ] T056 [P] [US3] Esquema Zod del perfil en `app/src/features/profile/schema.ts` con las mismas reglas que T055
- [ ] T057 [P] [US3] API del perfil con TanStack Query en `app/src/features/profile/api.ts` (leer y actualizar el propio perfil)
- [ ] T058 [P] [US3] Utilidad de zona horaria en `app/src/lib/timezone.ts`: detectar la del dispositivo y validar nombres IANA
- [ ] T059 [US3] `ProfileForm` y `ProfilePage` en `app/src/features/profile/ProfileForm.tsx` y `app/src/features/profile/ProfilePage.tsx`, con estados de carga, vacío (perfil sin completar), éxito y error, e integración del `ChangePasswordForm`
- [ ] T060 [US3] Inicio en `app/src/routes/HomePage.tsx` que guía a completar el perfil si faltan fecha de nacimiento, altura o zona horaria
- [ ] T061 [US3] Aviso para cambiar la zona horaria cuando la del dispositivo difiere de la guardada, sin cambiarla sin confirmación, en `app/src/features/profile/TimezoneNotice.tsx`

**Checkpoint**: el perfil se completa, se edita y persiste. Pasan T051 a T054.

---

## Phase 6: User Story 4 - Instalar la app y saber cuándo no hay conexión (Priority: P2)

**Goal**: PWA instalable solo con carcasa, mensaje claro sin conexión, nada mostrado como guardado sin confirmación del servidor, y borradores locales que se purgan al cerrar sesión.

**Independent Test**: escenarios 12 a 14 del `quickstart.md`.

### Tests for User Story 4 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T062 [P] [US4] Pruebas unitarias en `app/tests/unit/drafts.test.ts`: clave `draft:v1:<userId>:<formId>`, restauración validada con Zod, datos inválidos descartados, descarte al confirmar el servidor, purga de todo `draft:*` (FR-021, FR-022)
- [ ] T063 [P] [US4] Pruebas de componentes en `app/tests/component/useDraft.test.tsx`: el formulario recupera el borrador, muestra "Recuperamos lo que estabas escribiendo" y permite descartarlo
- [ ] T064 [P] [US4] Prueba de extremo a extremo en `app/tests/e2e/pwa-offline.spec.ts`: sin conexión se muestra el mensaje de no disponible; guardar sin conexión muestra error y no éxito; recargar conserva el borrador; cerrar sesión no deja `draft:*` (escenarios 12 a 14, FR-019 a FR-022)
- [ ] T065 [P] [US4] Prueba en `app/tests/e2e/pwa-install.spec.ts`: el manifiesto, los íconos y el service worker cumplen los requisitos de instalación (FR-018, SC-008)

### Implementation for User Story 4

- [ ] T066 [US4] Módulo de borradores en `app/src/lib/drafts.ts` (guardar, restaurar, descartar, purgar todo)
- [ ] T067 [US4] Hook `useDraft` en `app/src/lib/useDraft.ts` e integrarlo en `app/src/features/profile/ProfileForm.tsx`
- [ ] T068 [US4] Purgar borradores al cerrar sesión y ante `session_expired` en `app/src/features/auth/AuthProvider.tsx` (modifica el archivo de US1)
- [ ] T069 [US4] Configurar `vite-plugin-pwa` en `app/vite.config.ts`: precachear **solo la carcasa**, `navigateFallback` a `/sin-conexion`, **sin** caché en tiempo de ejecución ni cola de sincronización; manifiesto e íconos en `app/public/`
- [ ] T070 [US4] Página `/sin-conexion` en `app/src/routes/OfflinePage.tsx` y componente `OfflineNotice` en `app/src/components/OfflineNotice.tsx`
- [ ] T071 [US4] Envoltorio de mutaciones en `app/src/lib/mutation.ts` que convierte los fallos de red en error visible y garantiza que ningún dato se muestre como guardado sin respuesta del servidor (FR-020)

**Checkpoint**: la PWA se instala, avisa sin conexión y no pierde borradores. Pasan T062 a T065.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: calidad transversal y cierre

- [ ] T072 [P] Pruebas de accesibilidad con axe en las pantallas principales en `app/tests/e2e/a11y.spec.ts` (FR-024)
- [ ] T073 [P] Pruebas de ancho móvil y de escritorio en `app/tests/e2e/responsive.spec.ts` (SC-007)
- [ ] T074 Script `app/scripts/check-bundle-secrets.mjs` y el comando `check:secrets` en `app/package.json`: falla si el bundle o el repositorio contienen la clave de servicio, credenciales SMTP o el secreto de Turnstile (escenario 17, Principio I)
- [ ] T075 [P] `README.md` en la raíz con los comandos documentados para instalar, ejecutar, comprobar tipos, formato, lint y pruebas (Principio VIII)
- [ ] T076 [P] `Documentacion/despliegue.md`: despliegue en Cloudflare Pages y Supabase, variables por entorno, límites de los planes gratuitos y qué hacer si Supabase pausa el proyecto por inactividad
- [ ] T077 Despliegue inicial (requiere acción del autor): crear el proyecto de Supabase y el sitio de Cloudflare Pages, aplicar migraciones, configurar secretos y verificar los escenarios críticos en producción
- [ ] T078 Ejecutar los 17 escenarios del `quickstart.md` y registrar el resultado en `specs/001-cuentas-perfil-pwa/quickstart.md`
- [ ] T079 Revisión de seguridad de todo el cambio con la skill `security-review`: autorización, exposición de claves, límites de intentos y funciones de borde; corregir hallazgos
- [ ] T080 Ejecutar `npm run format:check`, `lint`, `typecheck`, `test`, `e2e` y `npx supabase test db`; todo en verde antes de dar la spec por terminada
- [ ] T081 Reevaluar antes de publicar, y anotar en `Documentacion/roadmap-specs.md`, si la confirmación de correo pasa a ser obligatoria y que la spec 011 es obligatoria con registro abierto

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup. **Bloquea todas las historias.** Los prototipos T007 a T009 condicionan T028 y T031
- **User Stories (Phase 3 a 6)**: dependen de Foundational
- **Polish (Phase 7)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational. Sin dependencias de otras historias
- **US2 (P1)**: después de US1, porque las políticas usan `private.is_session_fresh()` (T028)
- **US3 (P2)**: después de US2, porque necesita las políticas de lectura y escritura del perfil (T047)
- **US4 (P2)**: después de US1. Integra con el formulario de US3 (T067) y modifica `AuthProvider` de US1 (T068)

### Within Each User Story

- Las pruebas se escriben primero y se verifica que **fallen** antes de implementar
- Migraciones antes del código que las usa
- Esquemas y API antes de páginas
- Historia completa antes de pasar a la siguiente prioridad

### Parallel Opportunities

- En Setup: T002, T003, T004 y T006
- En Foundational: T008 y T009; T014 a T017; T020 y T021
- Dentro de cada historia: todas las pruebas marcadas [P]; las Edge Functions T029 y T030; los esquemas y APIs T032, T033, T056 a T058

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (deben fallar):
Task: "Prueba pgTAP de alta en supabase/tests/profiles_signup.test.sql"
Task: "Prueba pgTAP de sesión en supabase/tests/session_expiry.test.sql"
Task: "Pruebas de send-verification y confirm-email"
Task: "Pruebas de RegisterForm en app/tests/component/RegisterForm.test.tsx"

# Funciones de servidor de US1 en paralelo:
Task: "supabase/functions/send-verification/index.ts"
Task: "supabase/functions/confirm-email/index.ts"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Setup y Foundational, **empezando por los prototipos T007 a T009**
2. US1: cuentas y sesión
3. US2: aislamiento aplicado en la base de datos
4. **DETENERSE Y VALIDAR**: escenarios 1 a 8, 15 y 16. Es una base segura sobre la que puede construirse el resto
5. Desplegar si corresponde

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → probar → US2 → probar (MVP seguro)
3. US3 → perfil usable
4. US4 → PWA instalable y borradores
5. Polish → seguridad, accesibilidad, despliegue

### Si un prototipo falla

- T007 sin `amr` confiable → vencimiento de 30 días solo en el cliente (documentar la limitación) y simplificar T023, T028 y T043
- T008 sin Auth Hook → usar `request-password-reset` y documentar el residual (ver `research.md`, Decisión 3)
- Si la confirmación propia resulta demasiado costosa → consultar al autor sobre pasar a la confirmación nativa bloqueante

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- La etiqueta [Story] vincula cada tarea con su historia
- Verificar que las pruebas fallen antes de implementar
- Confirmar los cambios (commit) por tarea o grupo lógico
- Toda tabla nueva en las specs siguientes MUST seguir la convención de propiedad documentada en T050
- Los logs MUST NOT contener datos personales (Principio IX, T020/T021)
