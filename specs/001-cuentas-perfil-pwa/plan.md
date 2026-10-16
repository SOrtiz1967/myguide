# Implementation Plan: Cuentas, perfil y base de la PWA

**Branch**: `001-cuentas-perfil-pwa` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-cuentas-perfil-pwa/spec.md`

## Summary

Esta spec crea la base de toda la aplicación: cuentas con correo y contraseña, aislamiento de datos por propietario, perfil, y una PWA online-only con borradores locales.

Enfoque técnico (detalle y alternativas en [research.md](research.md)): SPA **Vite + React + TypeScript** instalable como PWA y desplegada en Cloudflare Pages, sobre **Supabase** (Auth, Postgres con RLS, Edge Functions). El aislamiento entre cuentas se aplica **en la base de datos** mediante RLS. Todo el sistema cabe en planes gratuitos. Dos requisitos de la spec no existen de forma nativa en el plan gratuito y se implementan a medida: la confirmación de correo no bloqueante y el vencimiento de sesión por inactividad de 30 días.

Esta spec también fija las decisiones técnicas pendientes **#1** (framework y despliegue) y **#2** (backend, autenticación, base de datos) de la Constitution, que heredan las demás specs.

## Technical Context

**Language/Version**: TypeScript en modo estricto, Node.js 24 (versión instalada en el entorno de desarrollo); SQL (Postgres) y TypeScript/Deno para Edge Functions

**Primary Dependencies**: React, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, vite-plugin-pwa, `@supabase/supabase-js`. Se fijan las últimas versiones estables al iniciar la implementación, con `package-lock.json` confirmado.

**Storage**: Postgres gestionado por Supabase (cuentas, perfiles, tokens de confirmación). `localStorage` en el navegador solo para borradores. Sin almacenamiento de archivos en esta spec (llega con la spec 008).

**Testing**: Vitest + Testing Library (unidad y componentes), Playwright (extremo a extremo, modo sin conexión), pgTAP vía `supabase test db` (RLS y funciones de sesión), axe para accesibilidad

**Target Platform**: navegadores modernos de escritorio y móvil; PWA instalable en Chrome/Edge y Android, e iOS vía "Añadir a pantalla de inicio". Despliegue: Cloudflare Pages (frontend) + Supabase (backend).

**Project Type**: aplicación web (frontend SPA + backend gestionado)

**Performance Goals**: carga inicial de la carcasa en menos de 3 segundos en una conexión móvil típica; registro e inicio de sesión sin esperas perceptibles (SC-001, SC-002 se miden de punta a punta, no por latencia de servidor)

**Constraints**: requiere conexión (sin modo offline); sin secretos en el cliente; hosting totalmente gratuito; correo transaccional con cuota gratuita limitada; proyecto de Supabase gratuito se pausa tras 1 semana sin actividad

**Scale/Scope**: uso personal en el MVP (una persona), diseño multiusuario con registro abierto; menos de 10 pantallas en esta spec

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).*

Evaluado contra la Constitution v1.2.0. Los principios II a V, IX parcial y X no aplican a esta spec salvo donde se indica.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | RLS en todas las tablas de usuario y pruebas de aislamiento entre cuentas; sin secretos en el bundle (solo `VITE_*` públicos); `anon` sin acceso; el aviso de privacidad se exige y se versiona. EXIF, fotos y proveedores de IA no aplican aún. | ✅ Cumple |
| **II. Integridad e idempotencia** | Alta idempotente (Decisión 11); zona horaria del perfil sin cambios silenciosos; planificado/ejecutado y snapshots no aplican todavía. | ✅ Cumple |
| **VI. Experiencia** | Responsive, PWA instalable, online-only con carcasa que solo muestra el mensaje, borradores locales y estados definidos, español y accesibilidad con axe. Funcionamiento básico sin integración externa salvo el correo (permitido por la spec). | ✅ Cumple |
| **VII. Arquitectura** | React + TypeScript; stack elegido con alternativas documentadas en `research.md`; secretos solo en el servidor; integraciones (SMTP, Turnstile) detrás de configuración; cálculos deterministas aislados. Dependencias mínimas. | ✅ Cumple |
| **VIII. Calidad y SDD** | Spec con criterios comprobables; pruebas trazables; comandos documentados en `quickstart.md`; tareas pequeñas en la fase siguiente. | ✅ Cumple |
| **IX. Observabilidad** | Esta spec no incluye herramienta de monitoreo (decisión #9, spec 011). Regla heredada: los registros de Edge Functions MUST NOT contener correos, tokens ni contraseñas. | ✅ Cumple con restricción |
| **Decisiones pendientes** | #1 y #2 se resuelven aquí; #3 a #9 permanecen pendientes y no se anticipan. | ✅ |

**Resultado**: sin violaciones. Se registran dos desviaciones respecto de lo nativo del proveedor en *Complexity Tracking*, justificadas por requisitos de la spec, no por la Constitution.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado anterior. La convención de propiedad de `data-model.md` queda como contrato obligatorio para las specs 002 a 011.

## Project Structure

### Documentation (this feature)

```text
specs/001-cuentas-perfil-pwa/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas y alternativas
├── data-model.md        # Fase 1: entidades, RLS y funciones
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   ├── backend-api.md   # Fase 1: Auth, Edge Functions, RPC y acceso a tablas
│   └── ui-routes.md     # Fase 1: rutas, estados y accesibilidad
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (lo crea /speckit-tasks)
```

### Source Code (repository root)

```text
app/                              # Frontend (React + TypeScript + Vite)
├── src/
│   ├── main.tsx
│   ├── routes/                   # Definición de rutas y guardas de acceso
│   ├── features/
│   │   ├── auth/                 # Registro, ingreso, recuperación, cambio de contraseña
│   │   └── profile/              # Perfil y zona horaria
│   ├── components/               # Componentes compartidos (estados de carga, vacío, error, aviso sin conexión)
│   ├── lib/
│   │   ├── supabase.ts           # Cliente único
│   │   ├── drafts.ts             # Borradores locales (guardar, restaurar, purgar)
│   │   └── session.ts            # touch_session / start_session / caducidad
│   └── copy/                     # Textos en español centralizados
├── public/                       # Íconos y manifiesto de la PWA
├── tests/
│   ├── unit/
│   ├── component/
│   └── e2e/
├── .env.example
├── package.json
└── vite.config.ts

supabase/                         # Backend como código
├── config.toml                   # Configuración de Auth (obligatoria, ver contracts/backend-api.md)
├── migrations/                   # Esquema, RLS, funciones, disparadores
├── functions/
│   ├── send-verification/
│   ├── confirm-email/
│   └── request-password-reset/   # Solo si el Auth Hook de correo no está disponible
└── tests/                        # Pruebas pgTAP (aislamiento entre cuentas, sesión fresca)
```

**Structure Decision**: dos raíces, `app/` (frontend) y `supabase/` (backend como código y migraciones), porque el aislamiento de datos vive en la base de datos y debe versionarse y probarse con independencia de la interfaz. La carpeta `specs/` y `Documentacion/` quedan en la raíz.

## Complexity Tracking

> Desviaciones de lo que ofrece el proveedor de forma nativa. Ninguna viola la Constitution; se justifican por requisitos de la spec.

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Confirmación de correo propia (tabla de tokens + 2 Edge Functions + hook o función de recuperación) | FR-026 y FR-027: la persona entra de inmediato y la recuperación exige correo confirmado | La confirmación nativa de Supabase es bloqueante y contradice la decisión explícita del autor. **Si el costo resulta alto, es la alternativa a reconsiderar con el autor.** |
| Vencimiento de sesión por inactividad a medida (`last_active_at`, `touch_session`, `start_session`, `is_session_fresh`) | FR-003: 30 días de inactividad, función de pago en Supabase | Dejar la sesión sin vencer contradice la spec; aplicarlo solo en el cliente es evadible. **Riesgo técnico #1: se prototipa primero**; el respaldo es la aplicación solo en el cliente, documentando la limitación. |

## Riesgos y verificaciones previas a implementar

1. `amr` en el JWT y renovación de tokens (Decisión 4).
2. Disponibilidad del Auth Hook de correo en el plan gratuito (Decisión 3).
3. Cuota y entregabilidad del SMTP gratuito (Decisión 5).
4. Pausa del proyecto gratuito tras 1 semana sin actividad (Decisión 2).
5. Enumeración de correos en el alta con acceso inmediato (Decisión 10): residual aceptado para el MVP.

Los tres primeros se convierten en tareas de prototipo al inicio de `tasks.md`.
