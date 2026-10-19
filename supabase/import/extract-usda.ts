// T046 (spec 002, FR-014, FR-029): extractor de USDA FoodData Central (Foundation Foods y SR Legacy).
// Lee los CSV oficiales por transmisión: food.csv, food_nutrient.csv, food_portion.csv y measure_unit.csv.
// Solo se conservan los alimentos que tienen traducción en data/usda-nombres-es.csv (FR-014).
import { CsvParseStream } from '@std/csv/parse-stream'
import { parse as parseCsv } from '@std/csv/parse'
import {
  dedupeUsda,
  type NormalizedFood,
  normalizeUsdaFood,
  type TranslationEntry,
  type UsdaDataType,
  type UsdaFoodInput,
  type UsdaPortion,
} from './normalize.ts'

export type UsdaFile = 'food.csv' | 'food_nutrient.csv' | 'food_portion.csv' | 'measure_unit.csv'

/** Un conjunto de datos de USDA (una carpeta con sus CSV). */
export interface UsdaDataset {
  data_type: UsdaDataType
  open(file: UsdaFile): Promise<ReadableStream<Uint8Array>>
}

export interface UsdaExtraction {
  foods: NormalizedFood[]
  /** Omisiones contadas durante la extracción (sin traducción, duplicados entre conjuntos...). */
  preSkipped: Record<string, number>
}

/** Nutrientes que usa la normalización (ver normalize.ts); el resto se descarta al leer. */
const WANTED_NUTRIENTS = new Set([
  1008,
  2047,
  2048,
  1062,
  1003,
  1005,
  2000,
  1063,
  1004,
  1258,
  1079,
  1093,
])

type Row = Record<string, string>

async function* rows(stream: ReadableStream<Uint8Array>): AsyncGenerator<Row> {
  const parsed = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream({ skipFirstRow: true }))
  for await (const row of parsed) yield row as Row
}

const VALID_STATUS = new Set(['machine_translated', 'reviewed'])

/** Lee `fdc_id,nombre_es,estado`. Una fila con un estado inválido o sin nombre se ignora. */
export function parseTranslations(csv: string): Map<string, TranslationEntry> {
  const map = new Map<string, TranslationEntry>()
  if (csv.trim() === '') return map
  for (const row of parseCsv(csv, { skipFirstRow: true }) as Row[]) {
    const id = (row.fdc_id ?? '').trim()
    const name = (row.nombre_es ?? '').trim()
    const status = (row.estado ?? '').trim()
    if (id && name && VALID_STATUS.has(status)) {
      map.set(id, { nombre_es: name, estado: status as TranslationEntry['estado'] })
    }
  }
  return map
}

export async function extractUsda(
  datasets: UsdaDataset[],
  translations: Map<string, TranslationEntry>,
): Promise<UsdaExtraction> {
  const preSkipped: Record<string, number> = {}
  const normalized: { food: NormalizedFood; data_type: UsdaDataType }[] = []

  for (const dataset of datasets) {
    // 1. Alimentos del conjunto; solo los traducidos se siguen leyendo.
    const inputs = new Map<string, UsdaFoodInput>()
    for await (const row of rows(await dataset.open('food.csv'))) {
      if (row.data_type !== dataset.data_type) continue
      const id = row.fdc_id
      if (!id) continue
      if (!translations.has(id)) {
        preSkipped.no_translation = (preSkipped.no_translation ?? 0) + 1
        continue
      }
      inputs.set(id, {
        fdc_id: id,
        description: row.description ?? '',
        data_type: dataset.data_type,
        nutrients: new Map(),
        portions: [],
      })
    }

    // 2. Nutrientes por 100 g.
    for await (const row of rows(await dataset.open('food_nutrient.csv'))) {
      const input = inputs.get(row.fdc_id)
      if (!input) continue
      const nutrientId = Number(row.nutrient_id)
      if (!WANTED_NUTRIENTS.has(nutrientId)) continue
      const amount = Number(row.amount)
      if (Number.isFinite(amount) && row.amount !== '') input.nutrients.set(nutrientId, amount)
    }

    // 3. Porciones, con el nombre de su unidad de medida.
    const units = new Map<string, string>()
    for await (const row of rows(await dataset.open('measure_unit.csv'))) {
      units.set(row.id, (row.name ?? '').trim())
    }
    for await (const row of rows(await dataset.open('food_portion.csv'))) {
      const input = inputs.get(row.fdc_id)
      if (!input) continue
      const portion: UsdaPortion = {
        amount: Number(row.amount),
        unit: units.get(row.measure_unit_id) ?? '',
        gram_weight: Number(row.gram_weight),
      }
      input.portions.push(portion)
    }

    for (const input of inputs.values()) {
      const result = normalizeUsdaFood(input, translations)
      if (result.ok) normalized.push({ food: result.food, data_type: dataset.data_type })
      else preSkipped[result.reason] = (preSkipped[result.reason] ?? 0) + 1
    }
  }

  const deduped = dedupeUsda(normalized)
  if (deduped.duplicates > 0) preSkipped.duplicate_name = deduped.duplicates
  return { foods: deduped.foods, preSkipped }
}

/** Abre los CSV de una carpeta del disco (uso real desde la línea de comandos). */
export function folderDataset(path: string, data_type: UsdaDataType): UsdaDataset {
  return {
    data_type,
    open: async (file) => (await Deno.open(`${path}/${file}`)).readable,
  }
}
