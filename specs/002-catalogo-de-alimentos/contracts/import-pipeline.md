# Contrato: pipeline de carga del catálogo

**Feature**: 002-catalogo-de-alimentos | Ejecuta el autor, fuera de la aplicación (FR-025).

## Formato intermedio normalizado (NDJSON, una línea por alimento)

```json
{
  "source_item_id": "7790895000010",
  "name": "Leche entera larga vida",
  "name_status": "original",
  "brand": "La Serenísima",
  "reference_basis": "100ml",
  "energy_kcal": 62,
  "protein_g": 3.0,
  "carbs_g": 4.7,
  "sugars_g": 4.7,
  "fat_g": 3.3,
  "saturated_fat_g": 2.1,
  "fiber_g": null,
  "sodium_mg": 45,
  "portions": [{ "name": "1 vaso", "quantity": 200 }]
}
```

- Un dato ausente es **`null`**, nunca `0`.
- Los nombres de campos son los de la tabla `foods`.

## Etapas

1. **Extraer** (una por fuente): produce el NDJSON.
   - `extract-off`: API de búsqueda de Open Food Facts filtrada a Argentina (con `User-Agent` identificado, ritmo cortés y reanudable), o el volcado por transmisión como respaldo.
   - `extract-usda`: CSV de Foundation Foods y SR Legacy, con la traducción de nombres de `data/usda-nombres-es.csv`.
2. **Normalizar y validar** (puro y probado): conversiones, descarte de imposibles, tope de volumen y puntaje de completitud.
3. **Cargar**: lotes de 500 a `import_foods` con la clave de servicio, y `finish_import` al final.

## Reglas de normalización

| Caso | Regla |
|---|---|
| Energía solo en kJ | `kcal = kJ / 4,184`, redondeada a 1 decimal |
| Sodio ausente y sal presente | `sodio_mg = sal_g × 400` (= sal / 2,5 × 1000) |
| Valor ausente | `null` |
| Valor negativo, o macros > 100 g por 100, o sin nombre | Se omite el registro y se cuenta con su motivo |
| Nombre en varios idiomas | `es`, si no el principal; sin traducir (productos de marca) |
| Producto sin ningún nutriente | Se omite (`no_nutrients`) |
| Duplicado dentro de la misma fuente | Gana el de mayor completitud |
| Mismo alimento en Foundation Foods y en SR Legacy (nombre normalizado igual) | Gana Foundation Foods; ambos se cargan bajo la fuente `usda-fdc` |
| Estado del nombre de un genérico USDA | Lo define la columna `estado` de `data/usda-nombres-es.csv` (`machine_translated` o `reviewed`); sin entrada en el CSV, el alimento se omite (`no_translation`) |

## Garantías

- **Idempotencia**: la clave es `(fuente, source_item_id)`. Repetir la carga no duplica ni toca alimentos propios ni copias (FR-026, FR-027).
- **Licencia**: sin `license_name`, `license_url` y `attribution` registrados para la fuente, la carga se rechaza (FR-013).
- **Sin datos personales**: los informes y registros contienen solo códigos de producto y motivos.
- **Tope de volumen**: la carga se corta en el máximo configurado (por defecto 60.000), priorizando los más completos.

## Configuración

Variables en `supabase/.env` (secretos del servidor; nunca en `app/`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Parámetros: `--source`, `--limit`, `--dry-run` (valida y cuenta sin escribir).
