# Backend (Supabase)

Backend de MyGuide como código: migraciones, funciones de borde (Edge Functions) y pruebas. Decisiones y alternativas: [`specs/001-cuentas-perfil-pwa/research.md`](../specs/001-cuentas-perfil-pwa/research.md).

## Estructura

| Carpeta | Contenido |
|---|---|
| `migrations/` | Esquema, RLS, funciones y disparadores. Una migración por cambio lógico, en orden cronológico. |
| `functions/` | Edge Functions (Deno): `register`, `request-password-reset`, `send-verification`, `confirm-email`, `meal-photo` y utilidades en `_shared/`. Cada una separa la lógica probada (`handler.ts`) de su conexión real (`index.ts`). |
| `tests/` | Pruebas pgTAP (`*.test.sql`) y la prueba de invariantes de configuración (`config.test.ts`). |
| `seed.sql` | Ayudantes de prueba en el esquema `tests`. **Solo local**: no se aplica a producción. |
| `config.toml` | Configuración de Auth y de las funciones. Las decisiones de seguridad están comentadas al final. |

## Entorno local

Requisitos: Docker Desktop en ejecución. La CLI de Supabase y Deno se instalan como dependencias de desarrollo (`npm install` en la raíz).

```powershell
npx supabase start                                   # base de datos, Auth, Storage y buzón de correo de pruebas
npx supabase functions serve --env-file supabase/.env.local   # Edge Functions
```

El buzón de correo local (Mailpit) está en <http://127.0.0.1:54324>: ahí llegan los correos de confirmación y recuperación en desarrollo. No se envía nada real.

## Variables de entorno de servidor (secretos)

Los secretos **nunca** van en `app/`, en variables `VITE_*` ni en el repositorio. Cada archivo está en `.gitignore`.

| Archivo | Para qué | Se sube a Git |
|---|---|---|
| `supabase/.env.local` | Funciones en desarrollo: SMTP hacia el buzón local y la clave de **prueba** de Turnstile | No |
| `supabase/.env` | Credenciales **reales** (Brevo y Turnstile). Copiar de `supabase/.env.example` | No |
| `app/.env.local` | Solo variables públicas del frontend (`VITE_*`) | No |

| Variable | Descripción | Dónde se obtiene |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT` | Servidor SMTP (`smtp-relay.brevo.com`, `587`) | Brevo → Settings → SMTP & API |
| `SMTP_USER` | Login SMTP, con la forma `xxxx@smtp-brevo.com` (no es el correo de registro) | Brevo → Settings → SMTP & API → SMTP |
| `SMTP_PASSWORD` | **Clave SMTP** (no la API key) | Brevo → "Generate SMTP key" |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Remitente verificado | Brevo → Settings → Senders, Domains, IPs |
| `TURNSTILE_SECRET_KEY` | Clave secreta del widget | Cloudflare → Turnstile → widget → Settings |
| `ALLOWED_ORIGINS`, `SITE_URL`, `FUNCTIONS_URL` | Origen del frontend y URL pública de las funciones | Según el entorno |

Para pruebas se usan las claves de prueba oficiales de Cloudflare: sitio `1x00000000000000000000AA`, secreto `1x0000000000000000000000000000000AA` (el captcha siempre aprueba).

### Límites de intentos elegidos

- Inicio de sesión: **10 intentos por IP cada 5 minutos** (`[auth.rate_limit] sign_in_sign_ups`). No hay bloqueo por cuenta: ese hook es de planes Teams/Enterprise (ver `research.md`, Decisión 6).
- Registro y recuperación: 10 solicitudes por IP por hora (función SQL `check_rate_limit`).
- Reenvío de confirmación: 60 segundos entre envíos y 5 por día por cuenta.

## Pruebas

```powershell
npm run test:db          # pgTAP: aislamiento entre cuentas, sesión, restricciones y soporte de funciones
npm run test:functions   # Deno: manejadores, validación, Turnstile, tokens, correo y registro técnico
npm run test:config      # invariantes de seguridad de config.toml
npm run test:import      # Deno: normalización, extractores y cargador del catálogo
```

## Convención de propiedad (obligatoria para toda tabla de usuario)

Aplica a las specs 002 a 011. Detalle en [`data-model.md`](../specs/001-cuentas-perfil-pwa/data-model.md). Lo hace cumplir `tests/rls_guardrail.test.sql`: **falla** si una tabla de `public` no cumple.

### Lista de verificación de una tabla nueva

- [ ] Tiene `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`.
- [ ] `alter table ... enable row level security` y `revoke all ... from anon, authenticated`.
- [ ] Políticas separadas de `select`, `insert`, `update` y `delete` con `user_id = (select auth.uid())` **y** `private.is_session_fresh()`.
- [ ] Permisos mínimos por columna (`grant select ...`, `grant update (columnas) ...`); nunca `grant all`.
- [ ] Ninguna política usa `using (true)` ni concede acceso a `anon`.
- [ ] Restricciones de integridad en la base (`check`, `unique`, `not null`), no solo en el cliente.
- [ ] Pruebas pgTAP de aislamiento: la cuenta B no lee, modifica ni borra filas de A; `anon` no accede; una sesión vencida no ve nada.
- [ ] Si guarda historial, guarda también un *snapshot* de los valores relevantes (Principio II) y planificado/ejecutado son tablas distintas.
- [ ] Skill `database-design` aplicada a la revisión.

### Plantilla de políticas

```sql
alter table public.<tabla> enable row level security;
revoke all on public.<tabla> from anon, authenticated;

grant select, insert on public.<tabla> to authenticated;
grant update (<columnas_editables>) on public.<tabla> to authenticated;

create policy <tabla>_select_own on public.<tabla>
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_insert_own on public.<tabla>
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_update_own on public.<tabla>
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh())
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_delete_own on public.<tabla>
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());
```

### Plantilla de prueba pgTAP

Usa los ayudantes de `seed.sql` (`tests.create_user`, `tests.authenticate_as`, `tests.authenticate_as_anon`, `tests.clear_authentication`). Un ejemplo completo está en `tests/profiles_rls.test.sql`.

## Funciones de servicio

Las funciones `public.check_rate_limit`, `issue_email_token`, `consume_email_token`, `email_token_stats`, `mark_email_verified`, `find_user_by_email` e `is_privacy_notice_current` solo las puede ejecutar `service_role` (las Edge Functions). Están en `public` porque `supabase-js` solo expone ese esquema por RPC; ni `anon` ni `authenticated` tienen permiso de ejecución.

## Catálogo de alimentos (spec 002)

### Tablas

| Tabla | Qué guarda | Quién la ve |
|---|---|---|
| `public.foods` | Alimentos del catálogo (`user_id` nulo, `origin = 'imported'`) y alimentos propios (`origin = 'own'`, con dueño) | El catálogo, cualquier cuenta con sesión vigente; lo propio, solo su dueño |
| `public.food_portions` | Porciones de consumo de cada alimento, aparte de los valores por 100 g/ml | Igual que su alimento |
| `public.food_sources` | Fuentes con licencia, atribución, fecha de la última importación y cantidad | Cualquier cuenta con sesión (solo lectura) |
| `private.import_runs` | Informe de cada carga | Solo `service_role` |

`food_sources` es una **tabla de referencia** sin `user_id`: está en la lista explícita de `tests/rls_guardrail.test.sql`. Agregar otra requiere justificarlo allí.

### Funciones

| Función | Quién la ejecuta | Qué hace |
|---|---|---|
| `search_foods(q, scope, page_size, page_offset)` | Cuentas con sesión | Búsqueda sin acentos ni mayúsculas, por palabras parciales, ordenada por relevancia, con tandas |
| `create_food(food, portions, request_id)` | Cuentas con sesión | Crea un alimento propio con sus porciones, atómico e idempotente |
| `update_food(id, food, portions)` | Cuentas con sesión | Edita un alimento propio y reemplaza sus porciones; el catálogo da `not_found` |
| `copy_food(id, request_id)` | Cuentas con sesión | Crea una copia propia (`based_on_food_id`) de un alimento visible |
| `import_foods(source_slug, items)` · `finish_import(source_slug, report)` | **Solo `service_role`** | Cargan y cierran la carga del catálogo; nunca tocan alimentos propios ni copias |

Los errores de validación tienen la forma `invalid_food:<motivo>:<campo>`.

> **Regla de rendimiento.** En una política RLS de una tabla con muchas filas, la vigencia de la sesión se escribe `(select private.is_session_fresh())`, nunca como llamada suelta: sin el `select`, la función se ejecuta por cada fila (con 50.000 alimentos pasó de ~230 ms a minutos). `tests/foods_rls.test.sql` lo verifica para las tablas de alimentos.

### Cargar el catálogo

La carga la hace el autor desde su equipo. Necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: para el entorno local están en `supabase/.env.local` (clave de desarrollo) y para producción en `supabase/.env` (**la clave `service_role` es un secreto: nunca va en `app/` ni en Git**).

```powershell
npm run import:muestra                      # ≈170 alimentos de ejemplo (fuente local "muestra-desarrollo")
npm run import:off                          # Open Food Facts, Argentina, por su API (ritmo cortés, reanudable)
npm run import:off -- --dump off.jsonl.gz   # o desde el volcado completo, por transmisión (no se carga en memoria)
npm run import:usda                         # USDA (ver "Cargar USDA")
npm run import:usda -- --dry-run            # valida y cuenta sin escribir nada
```

- Un dato que la fuente no informa queda **sin dato** (`null`), nunca 0. Se omiten, con su motivo, los registros imposibles (valores negativos, macronutrientes que suman más de 100 g, sin nombre, sin ningún nutriente...). El informe queda en `supabase/import/out/informe-<fuente>.json` y se muestra en pantalla.
- Repetir la carga no duplica nada: la clave es (fuente, código de origen). No toca alimentos propios ni copias.
- La carga se **rechaza** si la fuente no tiene licencia, enlace de licencia y atribución registrados (FR-013).
- Tope de volumen por defecto: 100.000 alimentos (los más completos). Se cambia con `--limit`.
- Una carga contra producción se hace con `npm run import:off:prod` / `import:usda:prod`, que leen `supabase/.env`.

### Cargar USDA

1. Descargar de <https://fdc.nal.usda.gov/download-datasets> los CSV de **Foundation Foods** y de **SR Legacy** y descomprimirlos en `supabase/import/out/usda/foundation` y `supabase/import/out/usda/sr_legacy` (cada carpeta con `food.csv`, `food_nutrient.csv`, `food_portion.csv` y `measure_unit.csv`). La carpeta `out/` no se sube a Git.
2. Los nombres de USDA están en inglés. Solo se cargan los alimentos que tienen una fila en `supabase/import/data/usda-nombres-es.csv` (`fdc_id,nombre_es,estado`).
3. `estado` es `machine_translated` (traducción sin revisar: la pantalla lo avisa) o `reviewed`.

**Corregir un nombre:** editar la fila en `usda-nombres-es.csv`, cambiar `estado` a `reviewed` y volver a ejecutar `npm run import:usda`. La carga actualiza el nombre y el estado sin duplicar el alimento.

### Procedencia de cada dato

| Dato | Fuente | Licencia |
|---|---|---|
| Productos de marca de Argentina | Open Food Facts | ODbL 1.0 (contenidos DbCL 1.0): atribución obligatoria |
| Alimentos genéricos | USDA FoodData Central (Foundation Foods y SR Legacy) | CC0 1.0 |
| Alimentos propios y copias | La persona usuaria | Privados de cada cuenta |

Detalle y texto de atribución en [`Documentacion/fuentes-datos.md`](../Documentacion/fuentes-datos.md); la aplicación los muestra en `/fuentes`.

## Registro de comidas (spec 003)

### Tablas

| Tabla | Qué guarda | Quién la ve y qué puede hacer |
|---|---|---|
| `public.meal_entries` | Ítems registrados: comida, día, origen (`manual`, `catalog`, y `estimated`/`confirmed` reservados para la spec 009), cantidad y una **instantánea** de los valores nutricionales | Solo su dueño. El cliente lee (`select`) y borra (`delete`); **no inserta ni modifica**: eso lo hacen las funciones |
| `public.log_day_starts` | Marca de «empecé a registrar este día», que cierra el día anterior para imputar comidas | Solo su dueño, lectura; la escribe `start_log_day` |
| `public.meal_photos` | Una foto como máximo por (cuenta, día, comida): ruta en el bucket, medidas y peso | Solo su dueño, **solo lectura**; la escribe la función `meal-photo` |

La instantánea (`energy_kcal`, `protein_g`...) la calcula un disparador (`private.prepare_meal_entry`) a partir del alimento visible para esa cuenta y la cantidad; el cliente nunca envía valores calculados de un ítem del catálogo. Editar o borrar después el alimento no cambia lo registrado.

### Funciones

Todas verifican `auth.uid()` y `private.is_session_fresh()`. Las que escriben son `security definer` (con `search_path` vacío) porque el cliente no tiene permisos de escritura sobre las tablas.

| Función | Qué hace |
|---|---|
| `add_meal_entry(entry, request_id)` | Agrega un ítem del catálogo o manual; idempotente por `request_id` |
| `update_meal_entry(id, changes)` | Cambia cantidad, comida, día o los valores de un ítem manual; recalcula la instantánea de un ítem del catálogo; un ítem ajeno da `not_found` |
| `recent_meal_items(max_items)` | Alimentos usados hace poco con su última cantidad |
| `log_day_status(client_timezone)` · `start_log_day(day, client_timezone)` | Regla del día: cuál es «hoy», qué día se propone y si el anterior sigue cerrándose; `start_log_day` solo acepta el «hoy» de la cuenta |
| `preview_repeat_meal(from_date, from_meal)` · `repeat_meal(from_date, from_meal, to_date, to_meal, request_id)` | Cuenta y copia una comida de otro día; los ítems del catálogo se recalculan con el alimento actual y los manuales o con el alimento ya borrado se copian; idempotente |

La zona horaria para el corte del día es la del perfil; si no hay, la del navegador (si es válida); si no, UTC. `private.log_day_status_at(usuario, ahora, zona)` recibe la hora como parámetro para poder probarla con hora simulada y no tiene permiso para el cliente.

### Fotos (bucket `meal-photos` y función `meal-photo`)

- El bucket es **privado**, de 3 MiB y solo `image/jpeg`; lo crea la migración `20261019000900_meal_photos_storage.sql` (también en producción). Las fotos se guardan como `<user_id>/<uuid>.jpg`. La persona solo puede **leer** su carpeta (política `meal_photos_storage_select_own`, con `(select private.is_session_fresh())`); no hay políticas de escritura ni de borrado para el cliente. La app pide una URL firmada de **600 s** y la renueva a los 540 s.
- **Cifrado en reposo:** el que da por defecto el almacenamiento de Supabase (AES-256 en el proveedor de la nube), como admite el Principio I para el MVP; la aplicación no agrega una capa propia. Las fotos viajan siempre por HTTPS y no se envían a ningún servicio externo.
- `meal-photo` (`POST` para subir o reemplazar, `DELETE` para quitar) es la **única** que escribe en el bucket y en `meal_photos`, con la clave de servicio, que vive solo en esa función. Verifica el token con Auth y que la actividad sea de los últimos 30 días, comprueba el origen, limita a **30 fotos por hora** por cuenta, rechaza más de 3 MiB y todo lo que no sea JPEG.
- **Limpieza de metadatos en el servidor:** aunque el navegador ya reduce la foto (JPEG de hasta 1600 px, calidad 0,8), el servidor no confía en eso: recorre los segmentos y conserva solo los de imagen; quita todos los `APPn` (EXIF, GPS, XMP, IPTC...) salvo `APP0`, de la que además anula la miniatura, quita los comentarios (`COM`) y descarta todo lo que venga después del marcador final. Al reemplazar o quitar, borra el archivo anterior; si falla la base de datos tras subir, borra el huérfano. `DELETE` es idempotente (204).
- Los registros de la función no incluyen la cuenta, la ruta, el día ni la comida.
- Supabase **prohíbe borrar con SQL** filas de `storage.objects`: los archivos solo se pueden borrar por la API de Storage.

> **Pendiente (Principio I): eliminar una cuenta.** Las filas de `meal_photos` se borran en cascada con la cuenta, pero **los archivos del bucket no**. Cuando se construya la eliminación de cuentas, tiene que borrar primero los objetos de `meal-photos/<user_id>/` con la API de Storage (clave de servicio) y después la cuenta. Hasta entonces, borrar un usuario a mano deja sus fotos huérfanas en el bucket. Ver `specs/003-registro-de-comidas/research.md`, Decisión 11.

### Pruebas

`tests/meal_entries_schema`, `meal_rls`, `add_meal_entry`, `manual_meal_entry`, `recent_meal_items`, `update_meal_entry`, `log_day_status`, `repeat_meal` y `meal_photos_storage` (pgTAP, todos `*.test.sql`) cubren el aislamiento, la instantánea, la idempotencia, la regla del día con hora simulada y las políticas del bucket; `functions/meal-photo/*.test.ts` (Deno) cubre la limpieza del JPEG y el manejador. La suite de la función usa `--allow-read` sobre sus fixtures: se ejecuta con `npm run test:functions`.
