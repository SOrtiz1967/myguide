# MyGuide

Aplicación web personal (PWA, solo en español) para registrar y analizar alimentación, entrenamiento, sueño y evolución física, sin presentar estimaciones como certezas ni fomentar conductas perjudiciales.

Desarrollada con **Spec-Driven Development** (Spec Kit). Los principios del proyecto están en [`.specify/memory/constitution.md`](.specify/memory/constitution.md) y el plan de specs en [`Documentacion/roadmap-specs.md`](Documentacion/roadmap-specs.md).

## Estado

| Spec | Estado |
|---|---|
| 001 Cuentas, perfil y base de la PWA | Implementada y verificada; pendiente la prueba de envío real de correo (T009) y el despliegue (T077) |
| 002 Catálogo de alimentos | Implementada y verificada; pendiente cargar los genéricos de USDA (traducción de nombres) y la carga en producción. Ver [`verification.md`](specs/002-catalogo-de-alimentos/verification.md) |
| 003 a 011 | Pendientes |

## Stack

Vite + React + TypeScript (PWA) · Supabase (Auth, Postgres con RLS, Edge Functions) · Cloudflare Pages · Brevo (SMTP) · Cloudflare Turnstile. Todo apto para planes gratuitos. Decisiones: [`research.md`](specs/001-cuentas-perfil-pwa/research.md).

## Requisitos

- Node.js 24 o superior y npm
- Docker Desktop (para Supabase local)

## Puesta en marcha

```powershell
npm install                  # CLI de Supabase y Deno (raíz)
npm install --prefix app     # frontend
npx supabase start           # base de datos, Auth y buzón de correo local
copy supabase\.env.local.example supabase\.env.local   # ver supabase/README.md para el contenido
npx supabase functions serve --env-file supabase/.env.local   # en otra terminal
copy app\.env.example app\.env.local   # completar con las claves que imprime `supabase start`
npm run dev --prefix app     # http://localhost:5173
```

Los correos de desarrollo llegan al buzón local: <http://127.0.0.1:54324>. Detalles de variables y secretos en [`supabase/README.md`](supabase/README.md).

## Verificación (Principio VIII)

Todo debe pasar antes de dar una funcionalidad por terminada.

| Qué | Comando |
|---|---|
| Formato | `npm run format:check --prefix app` |
| Lint | `npm run lint --prefix app` |
| Tipos | `npm run typecheck --prefix app` |
| Pruebas de unidad y componentes | `npm test --prefix app` |
| Pruebas de extremo a extremo (necesitan el stack local) | `npm run e2e --prefix app` |
| Pruebas de base de datos (pgTAP) | `npm run test:db` |
| Pruebas de Edge Functions (Deno) | `npm run test:functions` |
| Pruebas de la carga del catálogo (Deno) | `npm run test:import` |
| Invariantes de configuración | `npm run test:config` |
| Sin secretos en el bundle ni en el repositorio | `npm run check:secrets --prefix app` |

La primera vez que se corren las pruebas de extremo a extremo hay que instalar el navegador: `npx playwright install chromium` (desde `app/`).

## Catálogo de alimentos (spec 002)

El catálogo es una copia local de fuentes con licencia compatible (Open Food Facts y USDA FoodData Central); buscar y consultar no depende de ningún servicio de terceros. La carga la ejecuta el autor, no la aplicación:

| Qué | Comando |
|---|---|
| Muestra de desarrollo (≈170 alimentos de ejemplo) | `npm run import:muestra` |
| Open Food Facts, Argentina (API o volcado) | `npm run import:off` · `npm run import:off -- --dump archivo.jsonl.gz` |
| USDA FoodData Central (genéricos) | `npm run import:usda` |
| Lo mismo contra producción | `npm run import:off:prod` · `npm run import:usda:prod` |
| Simular sin escribir | agregar `-- --dry-run` |

Licencias y atribución: [`Documentacion/fuentes-datos.md`](Documentacion/fuentes-datos.md). Funcionamiento de la carga: [`supabase/README.md`](supabase/README.md).

## Estructura

```text
app/          Frontend (React + TypeScript + Vite)
supabase/     Backend como código: migraciones, funciones de borde y pruebas
specs/        Una carpeta por spec: spec, plan, investigación, modelo de datos, contratos y tareas
Documentacion/ Roadmap de specs y guía de despliegue
.specify/     Constitution y plantillas de Spec Kit
.claude/      Skills del proyecto (diseño, TDD, depuración, base de datos, reglas de nutrición)
```

## Despliegue

Guía paso a paso, límites de los planes gratuitos y qué hacer si Supabase pausa el proyecto: [`Documentacion/despliegue.md`](Documentacion/despliegue.md).
