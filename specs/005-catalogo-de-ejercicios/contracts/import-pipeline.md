# Contrato: pipeline de carga del catálogo de ejercicios

**Feature**: 005-catalogo-de-ejercicios | Ejecuta el autor, fuera de la aplicación (FR-031).

## Formato intermedio normalizado (NDJSON, una línea por ejercicio)

```json
{
  "source_item_id": "3_4_Sit-Up",
  "name": "Abdominales tres cuartos",
  "name_status": "machine_translated",
  "original_name": "3/4 Sit-Up",
  "aliases": ["Abdominales a tres cuartos"],
  "measurement_type": "reps_bodyweight",
  "primary_muscles": ["abdominals"],
  "secondary_muscles": [],
  "equipment": "body only",
  "description": "1. Acuéstate en el suelo y sujeta los pies...\n2. ...",
  "description_status": "machine_translated"
}
```

- Un dato opcional ausente es **`null`** (o `[]` en los arreglos), nunca un valor supuesto.
- Los nombres de campos son los de la tabla `exercises`.
- Los pasos de la fuente (una lista) se unen con saltos de línea, numerados.

## Entradas

| Archivo | Quién lo mantiene | Contenido |
|---|---|---|
| `dist/exercises.json` de free-exercise-db (commit fijado) | la fuente | 876 ejercicios en inglés; se descarga y se **verifica su SHA-256** antes de usarlo |
| `supabase/import/data/ejercicios-es.json` | el autor (con asistencia) | por `source_item_id`: `nombre`, `sinonimos`, `pasos`, `nombre_estado`, `pasos_estado` |
| `supabase/import/data/ejercicios-medicion.csv` | el autor | excepciones al tipo de medición: `source_item_id,tipo,motivo` |
| `supabase/import/data/ejercicios-base.json` | el autor (obra propia, CC0) | ejercicios de la fuente `myguide-base`, ya en español |

## Etapas

1. **Extraer** (una por fuente): produce el NDJSON.
   - `extract-exercises` para free-exercise-db: lee el JSON verificado y le aplica las traducciones y las excepciones de medición.
   - `extract-exercises-base` para `myguide-base`: lee el archivo propio.
2. **Normalizar y validar** (puro y probado): mapeo de músculos y equipamiento a las listas cerradas, tipo de medición, descarte de inválidos y topes de largo.
3. **Cargar**: lotes de 200 a `import_exercises` con la clave de servicio, y `finish_exercise_import` al final.

## Reglas de normalización

| Caso | Regla |
|---|---|
| Músculo o equipamiento de la fuente | Se mapea al código de la lista cerrada (los códigos de free-exercise-db coinciden); un valor sin equivalente se omite del arreglo y se cuenta en el informe (`unmapped_muscle`, `unmapped_equipment`) |
| Equipamiento ausente | `null` (sin dato); **no** se convierte en `body only` |
| Tipo de medición | Excepción de `ejercicios-medicion.csv` si existe; si no, la regla por categoría (`research.md`, Decisión 3); si no se puede determinar, se omite (`no_measurement_type`) |
| Sin entrada en `ejercicios-es.json` | Se omite (`no_translation`) |
| Pasos ausentes en la fuente | `description = null` y `description_status = null` (5 casos en la versión analizada) |
| Nombre vacío, o más de 120 caracteres | Se omite (`invalid_name`) |
| Descripción de más de 4.000 caracteres | Se omite el ejercicio (`description_too_long`) |
| Alias repetidos o iguales al nombre | Se descartan en silencio |
| Identificador repetido en la misma fuente | Gana el primero y se cuenta el resto (`duplicate_item`) |
| Una entrada de traducción marcada `reviewed` | Se conserva sobre cualquier traducción `machine_translated` |

## Garantías

- **Idempotencia**: la clave es `(fuente, source_item_id)`. Repetir la carga no duplica ni toca ejercicios propios, copias ni traducciones `reviewed` (FR-032, FR-033).
- **Licencia**: sin `license_name`, `license_url` y `attribution` registrados para la fuente, la carga se rechaza (FR-019).
- **Versión fijada**: si el SHA-256 de la fuente no coincide con el registrado, la carga se detiene antes de leer nada.
- **Sin datos personales**: los informes y registros contienen solo identificadores de la fuente y motivos.
- **`--sin-descripcion`**: carga el ejercicio sin su descripción (ni su estado) y quita la que hubiera, si el autor decide retirar los textos de una fuente (`research.md`, Decisión 2).

## Configuración

Variables en `supabase/.env` (secretos del servidor; nunca en `app/`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Parámetros: `--source` (`free-exercise-db` | `myguide-base`), `--dry-run` (valida y cuenta sin escribir), `--sin-descripcion`.
