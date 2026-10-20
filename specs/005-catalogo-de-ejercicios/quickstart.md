# Quickstart: validar la spec 005

**Feature**: 005-catalogo-de-ejercicios

## Requisitos previos

Los de las specs 001 a 004: Docker Desktop, `npx supabase start`, las Edge Functions servidas (`npx supabase functions serve --env-file supabase/.env.local`; el registro de cuentas las necesita), el frontend en marcha y las migraciones aplicadas. Esta spec **no agrega funciones de borde**.

```powershell
npx supabase migration up                      # o db reset + los import:muestra
npm run import:ejercicios-muestra              # ~30 ejercicios de desarrollo (no toca nada propio)
npm run dev --prefix app
```

## Comandos de verificación

```powershell
npm run test:db          # pgTAP: tablas, RLS, funciones, búsqueda y solo lectura del catálogo
npm run test:import      # Deno: normalización, reglas de medición, traducciones y carga
npm test --prefix app    # Vitest: búsqueda, filtros, formulario, detalle y fuentes
npm run e2e --prefix app # Playwright (por partes si falta memoria)
npm run check:secrets --prefix app
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Buscar "sentadilla" | 1 | Lista con nombre, tipo de medición en palabras, músculo principal, equipamiento y marca «Del catálogo» |
| 2 | Buscar "Elevación Lateral" y "elevacion lateral" | 1 | Mismos resultados (sin importar acentos ni mayúsculas) |
| 3 | Abrir un ejercicio completo | 1 | Nombre, «También se conoce como», tipo de medición explicado, músculos, equipamiento y pasos numerados |
| 4 | Abrir un ejercicio sin equipamiento o sin descripción | 1 | «Sin dato» donde falta; nunca vacío ni «peso corporal» supuesto |
| 5 | Ver la procedencia de un ejercicio importado | 1 | Fuente, código de origen y fecha; enlace a la fuente |
| 6 | Un ejercicio con traducción sin revisar y uno revisado | 1 | «Traducción sin revisar» solo en el primero (nombre y descripción por separado) |
| 7 | Buscar algo que no existe | 1 | Mensaje y botón «Crear [lo buscado]» |
| 8 | Buscar con una letra, y buscar con espacios | 1 | Indicación de escribir al menos 2 caracteres |
| 9 | Pedir «Ver más» en una búsqueda larga | 1 | Se suman resultados sin perder los anteriores |
| 10 | Cambiar entre Todos, Del catálogo y Mis ejercicios; ir al detalle y volver | 1 | Cada pestaña muestra lo suyo; el estado vuelve intacto |
| 11 | Filtrar por músculo «Pecho» | 1 | Solo ejercicios con pecho como principal o secundario; la lista anuncia la cantidad |
| 12 | Filtrar por equipamiento «Mancuernas» y por músculo a la vez, con texto | 1 | La intersección; los filtros se quitan con un gesto |
| 13 | Filtros sin resultados | 1 | Mensaje que dice qué filtros están activos y permite quitarlos |
| 14 | Buscar «squat» y un sinónimo | 1 | Encuentra el ejercicio; se muestra con su nombre en español |
| 15 | Crear un ejercicio con solo nombre y tipo de medición | 2 | Se guarda; músculos, equipamiento y descripción dicen «sin dato» |
| 16 | Crear uno completo (músculos, equipamiento, descripción, otros nombres) | 2 | Se guarda; aparece al buscar por nombre y por otro nombre, marcado «Propio» |
| 17 | Nombre vacío, tipo sin elegir, descripción enorme | 2 | Cada uno se rechaza con su mensaje; no se guarda nada |
| 18 | Crear con un nombre que ya existe entre los propios | 2 | Aviso, y se guarda igual |
| 19 | Doble clic en «Guardar» | 2 | Un solo ejercicio |
| 20 | Cortar la red al guardar | 2 | Aviso de que no se guardó; lo escrito se conserva; reintentar funciona |
| 21 | Cerrar y reabrir con el formulario a medias | 2 | El borrador vuelve; cerrar sesión lo borra |
| 22 | Otra cuenta busca un ejercicio propio | 2 | No lo ve ni puede abrirlo |
| 23 | «Crear mi versión» de un ejercicio del catálogo y editar nombre y descripción | 3 | Copia propia «basada en»; el original no cambia; otra cuenta lo ve igual |
| 24 | Copiar dos veces | 3 | Dos copias independientes |
| 25 | Editar y eliminar un ejercicio propio | 4 | Cambios visibles; al eliminar, desaparece de las búsquedas y las copias siguen |
| 26 | Intentar editar o eliminar uno del catálogo (también por la API) | 4 | No se puede; solo «Crear mi versión» |
| 27 | Cargar el catálogo dos veces con los mismos datos | 5 | 0 duplicados; propios, copias y traducciones revisadas intactos |
| 28 | Cargar con una fuente sin licencia, con un SHA-256 distinto, y con un ejercicio sin traducción | 5 | Se rechaza / se detiene / se omite con motivo en el informe |
| 29 | Abrir /fuentes | 6 | Secciones «Alimentos» y «Ejercicios» con licencia, atribución, fecha y cantidad |
| 30 | La cuenta B intenta leer o cambiar lo de A (tablas, funciones y petición anónima) | todas | No ve ni cambia nada |
| 31 | Teléfono y escritorio, teclado y lector de pantalla | todas | Sin desplazamiento horizontal; axe sin problemas graves; el tipo de medición se entiende sin ícono |
| 32 | Buscar con 2.000 ejercicios en el catálogo | 1 | El 95 % de las búsquedas responde en menos de 1 s |

## Criterio de terminado

Todos los comandos de verificación pasan y los 32 escenarios se cumplen. Además, la revisión de licencias del autor (`Documentacion/issues-autor/05-ejercicios-licencias.md`) está registrada antes de abrir la aplicación a terceros.
