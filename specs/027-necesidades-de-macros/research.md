# Investigación: Estimación de necesidades de macros según objetivo

Esta investigación fija los métodos antes de implementar, como pide el documento de origen. Las referencias deben **verificarse en la fuente primaria** antes de implementar; aquí se anotan las que sostienen cada decisión.

## Decisión 1: energía = método de la spec 015

**Decisión**: sin cambios. Mifflin-St Jeor, factor por trabajo, gasto de entrenamiento aparte, ajuste por objetivo con pisos.
**Razón**: ya implementado, probado y confirmado por personas; cambiarlo alteraría objetivos vigentes.

## Decisión 2: proteína

**Decisión**: rangos de la spec 015 (1,6–2,2 g/kg para ganar músculo; 1,8–2,4 g/kg para perder grasa y recomposición).
**Fuentes a verificar**: meta-análisis de Morton et al. (2018) sobre suplementación proteica y ganancia de masa magra (punto de inflexión cerca de 1,6 g/kg); posición de la ISSN sobre proteína (Jäger et al., 2017); revisión de Helms et al. (2014) para fases de déficit.
**Presentación**: rango en gramos y por kilo, con la salvedad de que es una estimación.

## Decisión 3: grasas

**Decisión**: entre 0,6 y 1,0 g/kg, con piso del 20 % y tope del 35 % de la energía.
**Razón**: el rango de referencia de ingesta para adultos (Institute of Medicine) es 20 a 35 % de la energía; el piso por kilo protege de ingestas muy bajas en personas de peso bajo. Documentar el caso en que ambos límites se contradigan: gana el piso de energía y se informa.

## Decisión 4: carbohidratos

**Decisión**: el resto de la energía tras proteína y grasas, calculado en los extremos del rango. Sin mínimo propio.
**Razón**: no hay una ingesta mínima establecida de carbohidratos para adultos sanos más allá de aportar energía; el documento de origen pide «resto de energía».

## Decisión 5: revisión con datos reales

**Decisión**: tendencia de peso (promedio móvil de 7 días) contra la esperada: ganar músculo +0,25 a +0,5 % del peso por semana; perder grasa −0,5 a −1,0 % por semana; mantenimiento y recomposición ±0,25 %. Mínimo de 6 semanas, 8 pesajes y 70 % de los días con comida. Fuera de rango sostenido durante 3 semanas: «sugerir revisar», con la evidencia (promedio de calorías registradas, peso inicial y final del período, cantidad de datos).
**Razón**: Principios IV y V; no reaccionar a fluctuaciones de agua, sal o glucógeno. Los umbrales son punto de partida y se calibran con datos de uso real.
**Relación con la spec 010**: el mantenimiento estimado de 010 se muestra junto a la revisión como contraste, no como fuente única.

## Decisión 6: seguridad

Edad mínima 18; piso de energía y excepción por IMC de la spec 015; sin déficits mayores al 20 % ni superávits mayores a 500 kcal; la propuesta no cambia sola ni es exacta.

## Decisión 7: sin IA

Todo es determinista. La IA no interviene en ningún cálculo ni redacción de esta spec.

## Preguntas que se resuelven al implementar

- Si el rango de carbohidratos queda negativo en algún extremo (déficit con proteína y grasas altas), se fija en 0 y se informa que el objetivo es poco realista; verificar con casos extremos.
- Valor por defecto de grasas por kilo para personas de IMC alto (propuesta: usar el peso de referencia, no el peso real, por encima de IMC 30).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Proteína: default 1,6 g/kg con rango 1,4–2,0 (ISSN 2017; Morton 2018). Más de 2,2 solo opcional en déficit y entrenados (ISSN/Helms 2014: 2,3–3,1 g/kg magra). Mayores de 65: ≥1,0–1,2 (PROT-AGE 2013). Aviso por enfermedad renal. Confianza: verificado.
- Grasa: Helms 2014 da 15–30 % de la energía; el piso del 20 % de la decisión actual no tiene fuente primaria hallada (el IOM da 20–35 %, pendiente de verificar). Tratar como rango informativo.
- Hidratos: bandas 3–5, 5–7, 6–10 y 8–12 g/kg según horas de entrenamiento (posición conjunta AND/DC/ACSM 2016). La banda 10–12 no se confirmó.
- Fibra 14 g/1000 kcal (IOM); sodio <2 g/día (OMS): rangos informativos, nunca objetivos que «fallan».
- Peso: ±0,5 % es plausible sobre media móvil de 7 días (variación semanal media ~0,35 %, Turicchi 2020), pero ningún estudio fija ese número; exigir ≥4 pesajes en la ventana (decisión de producto). Orsama 2014: máximo domingo/lunes.
- No usar 7700 kcal/kg como regla fija (Hall 2011 usa modelo dinámico). Mifflin-St Jeor por defecto con incertidumbre (22 % de casos con error >10 %); Cunningham/ten Haaf mejor en deportistas.
- Tasas: pérdida 0,5–1 %/semana (Helms 2014; Garthe 2011); ganancia 0,25–0,5 %/semana solo novatos/intermedios (Iraki 2019).
