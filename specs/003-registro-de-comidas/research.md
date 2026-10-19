# Research: Registro de comidas

**Feature**: 003-registro-de-comidas | **Fecha**: 2026-10-19

Decisiones técnicas de la spec 003. Se apoyan en el stack de la spec 001 (Vite + React + TanStack Query, Supabase con RLS y Edge Functions en Deno) y en el catálogo de la spec 002.

## Decisión 1: una tabla de ítems con instantánea

- **Decisión**: `public.meal_entries`, una fila por ítem registrado, con:
  - la referencia opcional al alimento (`food_id`, `on delete set null`);
  - una **instantánea** del alimento al registrar (nombre, marca, base y los 8 valores por 100 g/ml);
  - la cantidad (g o ml), y la porción usada si la hubo (nombre, cantidad de la porción, número de porciones);
  - los **valores calculados** para la cantidad.
  
  Los valores calculados los fija un disparador a partir de la instantánea (ítems del catálogo o propios) y nunca a partir del alimento actual. En los ítems manuales son los valores escritos.
- **Por qué**: cumple el Principio II por diseño. Editar, eliminar o reimportar un alimento no puede alterar el pasado, porque el ítem no vuelve a leer el alimento. Un disparador garantiza que los valores calculados siempre corresponden a la instantánea y la cantidad, venga el cambio de donde venga. La prueba guardiana de claves foráneas de la spec 002 ya exige `on delete set null` para toda referencia a `foods`.
- **Alternativas**: guardar solo la referencia y calcular al leer (viola el Principio II); una tabla de "comidas" con ítems hijos (agrega una entidad que el usuario no ve como tal: una comida es simplemente "día + tipo"); guardar solo los valores calculados sin los valores por 100 (impide recalcular al cambiar la cantidad).

## Decisión 2: escrituras por funciones SQL, idempotentes

- **Decisión**: el cliente no inserta ítems directamente:
  - `add_meal_entry(entry, request_id)` toma la instantánea **en el servidor**, leyendo el alimento con RLS (solo uno visible), y calcula la cantidad equivalente si se eligió una porción.
  - `update_meal_entry(id, changes)` cambia la cantidad, la porción, la comida, el día o, si es manual, la descripción y los valores.
  - `repeat_meal(...)` repite una comida.
  - Eliminar es un `delete` directo con RLS.
  - La idempotencia se logra con `client_request_id` único por cuenta, igual que en la spec 002.
- **Por qué**: una instantánea tomada en el servidor no depende de que el cliente envíe valores correctos y se toma en la misma transacción que el alta. Reutiliza los patrones ya probados de `create_food` y `copy_food`.
- **Alternativas**: insert directo con disparador que copie del alimento (más difícil de validar la porción y de dar errores claros); enviar la instantánea desde el cliente (confía en datos del cliente sin necesidad).

## Decisión 3: totales calculados en el cliente con funciones puras

- **Decisión**: la vista del día pide los ítems del día (como mucho unas decenas) y calcula subtotales y totales con funciones puras y probadas (`mealTotals.ts`). Cada total lleva la suma de lo informado y la cantidad de ítems que no informan ese nutriente; así puede mostrarse "al menos 45 g · falta en 2 ítems". El redondeo es el de `nutrition.ts` (energía sin decimales, gramos con un decimal).
- **Por qué**: son pocos datos. El cálculo es trivial y queda probado en aislamiento (Principio VII), y no hace falta otra consulta ni una vista en la base. La spec 004 lo reutiliza.
- **Alternativas**: vista SQL con agregados (duplica la regla de "incompleto" en SQL y en TS); totales guardados (riesgo de desincronizarse).

## Decisión 4: regla del día

- **Decisión**:
  - El ítem guarda `log_date` (fecha, no hora): el día queda fijado al guardar y no se mueve por cambios de zona horaria o de horario de verano (FR-026).
  - "Hoy" se calcula con la zona horaria del perfil; si el perfil no la tiene, con la del dispositivo y un aviso (como en la spec 001).
  - La función `log_day_status(client_timezone)` (que llama a `private.log_day_status_at(ahora, zona)`; las pruebas ejercitan esa función privada con una hora simulada, y la pública siempre usa `now()`) devuelve `{today, proposed_date, closing}`. `proposed_date` es **ayer** si se cumplen las tres condiciones siguientes:
    1. hoy no tiene ítems,
    2. la persona no eligió "Empezar el día de hoy",
    3. ayer sí tiene ítems ("el día que se está cerrando").
    
    En cualquier otro caso es hoy. Sin límite de hora, según la aclaración del autor.
  - "Empezar el día de hoy" guarda una marca en `public.log_day_starts (user_id, log_date)`.
- **Por qué**: la condición 3 evita proponer "ayer" a quien no usó la aplicación ayer (no hay un día que cerrar). La marca explícita respeta la decisión de la persona sin depender de que registre algo. Calcularlo en la base usa el mismo reloj para todos los dispositivos.
- **Alternativas**:
  - Una columna en `profiles`: mezcla datos de la spec 001 y exige ampliar sus permisos por columna.
  - Calcularlo solo en el cliente: dos dispositivos con relojes distintos podrían discrepar.
  - Un corte a una hora fija: el autor eligió no tener límite de hora.

## Decisión 5: recientes

- **Decisión**: la función `recent_meal_items(limit 20)` devuelve los últimos 20 ítems "distintos" de la persona:
  - Se agrupan por `food_id` cuando hay alimento y por la descripción normalizada cuando es manual.
  - Cada uno trae su última cantidad (y porción) y su fecha.
  - Se omiten los que vienen de un alimento que ya no existe o que la persona ya no puede ver, mediante un join con `foods` aplicando RLS.
  
  Volver a registrar un reciente es un `add_meal_entry` con esos datos.
- **Por qué**: una consulta indexada (`user_id, created_at desc`) sobre los ítems de una sola persona; no hace falta una tabla aparte.
- **Alternativas**: tabla de recientes mantenida por disparador (más piezas que pueden desincronizarse); frecuentes (descartado en la aclaración).

## Decisión 6: repetir una comida

- **Decisión**: `repeat_meal(from_date, from_meal, to_date, to_meal, request_id)` crea, en una transacción, un ítem nuevo por cada ítem de origen:
  - Si el ítem viene de un alimento que todavía existe y es visible, **recalcula** con una instantánea nueva del alimento, con la misma cantidad.
  - Si no, copia lo registrado.
  
  Para la idempotencia, cada ítem nuevo recibe un `client_request_id` derivado de forma determinista de `(request_id, id del ítem de origen)`. Un reintento no puede duplicar ninguno, aunque el primer intento se haya cortado a la mitad: la transacción es atómica. La función devuelve cuántos ítems se recalcularon y cuántos se copiaron. Para mostrarlos antes de confirmar, la pantalla usa `preview_repeat_meal` (solo lectura).
- **Por qué**: cumple la aclaración del autor y reutiliza la idempotencia por `client_request_id`.
- **Alternativas**: una tabla de solicitudes de repetición (otra tabla sin aportar nada); copiar siempre (descartado por el autor).

## Decisión 7: fotos de comidas

- **Decisión**:
  1. **En el navegador**: se valida que sea una imagen y que no supere los 15 MB, se decodifica (`createImageBitmap`), se reduce a 1600 px como máximo en el lado mayor y se vuelve a codificar como **JPEG** de calidad 0,8. Volver a codificar descarta los metadatos y achica el archivo.
  2. **En el servidor**: una Edge Function `meal-photo`:
     - verifica la sesión;
     - comprueba que el archivo sea JPEG por sus bytes iniciales y que pese menos de 3 MB;
     - **quita igual cualquier segmento de metadatos** (APP1 con EXIF y XMP, APP13 de IPTC, COM y los demás APPn salvo APP0/JFIF), sin decodificar la imagen;
     - guarda el archivo con la clave de servicio en el bucket privado `meal-photos`, en `<user_id>/<uuid>.jpg`;
     - registra la foto en `public.meal_photos`, con una por comida y día (reemplaza y borra la anterior).
  3. **Para ver la foto**: URL firmada de corta duración (10 minutos). Una política de Storage solo deja leer a la dueña o el dueño, por la carpeta `<user_id>/`; nadie tiene permiso de escribir ni de listar desde el cliente.
  4. **Cifrado en reposo**: el que da por defecto el almacenamiento de Supabase (AES-256 en el proveedor de la nube), como admite el Principio I para el MVP. Queda documentado en `supabase/README.md`.
- **Por qué**:
  - El Principio I exige quitar los metadatos **en el servidor**, aunque el cliente ya los haya quitado.
  - Quitar segmentos de un JPEG es manipular bytes, sin dependencias ni decodificar.
  - Comprimir en el cliente ahorra datos móviles (Principio VI) y deja una sola forma de archivo que el servidor debe entender (JPEG).
  - La escritura solo por la función impide subir archivos sin pasar por la limpieza.
- **HEIC**: solo se puede usar si el navegador sabe decodificarlo (Safari en iPhone suele hacerlo; Chromium no). Si no puede, se rechaza con un mensaje claro ("Este formato no se puede abrir en este navegador; probá con JPEG o PNG"). Se verifica en el prototipo P2.
- **Alternativas**:
  - Subir directo a Storage desde el cliente: no hay limpieza en el servidor y viola el Principio I.
  - Decodificar y volver a codificar en la Edge Function: necesita una biblioteca de imágenes, y el plan gratuito limita memoria y tiempo de CPU.
  - Transformaciones de imágenes de Supabase: no están en el plan gratuito y no garantizan quitar los metadatos del original.
  - Bucket público con nombres impredecibles: viola el Principio I.

## Decisión 8: validaciones y límites

| Dato | Regla |
|---|---|
| Cantidad de un ítem del catálogo o propio | mayor que 0 y hasta 5.000 g o ml |
| Número de porciones | mayor que 0 y hasta 50 |
| Descripción de un ítem manual | de 1 a 200 caracteres, sin espacios en los extremos |
| Cantidad descriptiva de un ítem manual | opcional, hasta 60 caracteres |
| Energía de un ítem manual | obligatoria, de 0 a 5.000 kcal |
| Gramos de un ítem manual (proteínas, carbohidratos, azúcares, grasas, saturadas, fibra) | de 0 a 1.000 g; azúcares ≤ carbohidratos; saturadas ≤ grasas |
| Sodio de un ítem manual | de 0 a 50.000 mg |
| Día | desde el 1/1/2000 hasta 7 días después de hoy en la zona horaria del perfil; sin zona en el perfil, en UTC con un día de tolerancia |
| Foto | JPEG, PNG, WebP o HEIC (si el navegador lo decodifica) hasta 15 MB al elegirla; JPEG de hasta 3 MB al subirla |

Las mismas reglas están en Zod (cliente) y en la base o la función (servidor). Los errores tienen la forma `invalid_entry:<motivo>:<campo>`, como en la spec 002.

## Decisión 9: pantallas y rutas

- `/comidas`: lleva al día propuesto (`proposed_date`).
- `/comidas/:fecha` (AAAA-MM-DD): la vista del día.
- `/comidas/:fecha/agregar?comida=`: agregar (recientes, búsqueda y entrada manual).
- `/comidas/item/:id`: detalle y edición de un ítem.

El enlace "Comidas" se suma a la cabecera. Las pantallas son páginas, no diálogos superpuestos: cada formulario tiene su borrador (`meal-add-<fecha>-<comida>`, `meal-edit-<id>`) y el botón Atrás del teléfono funciona. Detalle en `contracts/ui-routes.md`.

## Decisión 10: observabilidad y privacidad

La Edge Function `meal-photo` registra solo el resultado (aceptada o rechazada y el motivo), el tamaño y la duración, con el identificador de solicitud que ya usan las funciones de la spec 001. Nunca registra el contenido, la ruta con el `user_id` ni los metadatos que quitó (Principio IX).

## Decisión 11: eliminar una cuenta y los archivos de fotos

Las filas de `meal_photos` se borran en cascada con la cuenta, pero **los archivos de Storage no**: quedarían huérfanos. El flujo de eliminación de cuenta (pendiente por la Constitution, Principio I) debe borrar los objetos de la carpeta `<user_id>/` del bucket con la API de Storage antes de borrar la cuenta. Se documenta en `supabase/README.md` y en `verification.md`; no se construye en esta spec porque la eliminación de cuentas no existe todavía.

## Riesgos y prototipos antes de implementar

1. **P1, quitar metadatos de un JPEG en la Edge Function**: con una foto real de teléfono con GPS en su EXIF, comprobar que después de la función no queda ningún segmento APP1/APP13/COM, que la imagen se sigue viendo y que la función tarda menos de 1 s.
2. **P2, decodificación en el navegador**: comprobar qué formatos decodifica `createImageBitmap` en Chromium (escritorio y Android) y documentar el comportamiento de HEIC. Medir el tamaño resultante de una foto de 12 MP (objetivo: menos de 500 KB).
3. **P3, acceso privado en Storage**: en el entorno local, comprobar que la dueña o el dueño obtiene una URL firmada, que otra cuenta y una petición anónima no pueden leer ni listar, y que una URL firmada vencida ya no sirve.
4. **Regla del día y zonas horarias**: pruebas pgTAP con distintas zonas horarias y el paso por la medianoche, simulando la hora.
