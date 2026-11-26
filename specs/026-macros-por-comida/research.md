# Investigación: Macros por comida

## Hallazgo: los datos ya existen

`meal_entries` guarda por registro `energy_kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sodium_mg` (más azúcares y grasa saturada), valores `per100_*` de la instantánea y `origin`/`status`. La spec 004 ya calcula el total diario. Esta spec no recalcula nada en el servidor.

## Decisión 1: totales en el cliente

**Decisión**: sumar en una función pura del cliente, probada contra valores calculados a mano.
**Razón**: es el patrón de `mealTotals.ts` y de la spec 004; evita una función nueva que duplique la lógica.

## Decisión 2: «sin dato» y totales parciales

**Decisión**: el total de un macro suma los valores presentes e indica cuántos ítems lo aportan; sin ninguno, «sin dato».
**Alternativa descartada**: tratar `null` como 0 (viola el Principio II y el criterio de la spec).

## Decisión 3: conservar la estimación original

**Decisión**: columna `original_estimate jsonb` en el ítem.
**Razón**: `ai_estimates` solo guarda 24 horas el resultado de cada consulta como caché y no es del usuario; para poder volver a la estimación y recalcular proporcionalmente hace falta guardarla con el registro.
**Privacidad**: contiene solo nombre, cantidad y valores estimados de un alimento; no hay fotos ni datos personales. Entra en `export_my_data()` por ser columna de `meal_entries`.

## Decisión 4: recalcular proporcionalmente los estimados

Un ítem estimado no tiene `per100_*`. Al cambiar la cantidad, los valores se escalan por `cantidad_nueva / cantidad_original` a partir de `original_estimate`. Es determinista y no usa IA (FR-006, FR-007). Se muestra siempre como «estimado».

## Decisión 5: precisión en pantalla

Calorías enteras y macros con un decimal como máximo, respetando el Principio III (no mostrar más precisión que la de los datos).

## Preguntas que se resuelven al implementar

- Si una comida solo tiene ítems sin fibra, se omite la fila de fibra en lugar de mostrar «sin dato» para evitar ruido (propuesta; se valida con la persona usuaria).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Error de estimación de porciones por IA ~36–37 % (MAPE, preprint sin revisión por pares): respalda mostrar rangos y exigir confirmación. Confianza: parcial.
- Lenguaje no coercitivo y opción de ocultar calorías: asociación correlacional entre apps de conteo y síntomas de TCA (Levinson 2017; Simpson y Mazzeo 2017). Confianza: parcial.
