# Investigación: Progresión automática de entrenamiento

## Decisión 1: doble progresión

**Decisión**: rango de repeticiones por ejercicio; al llegar al máximo en todas las series de forma consistente se sube el peso y se vuelve al mínimo.
**Razón**: método simple, explicable y verificable que coincide con el ejemplo del documento de origen; no requiere modelos ni IA.
**Fuentes a verificar**: posición de la ACSM sobre progresión en entrenamiento de resistencia (2009) y revisión de Schoenfeld et al. sobre rango de repeticiones e hipertrofia (2017); verificar que 8–12 como rango por defecto es razonable para el objetivo de hipertrofia y ajustarlo para fuerza (por ejemplo 3–6) según el objetivo del perfil (spec 025).

## Decisión 2: criterio de «consistente»

**Decisión**: dos sesiones seguidas con el mismo peso y todas las series en el máximo del rango. Una sola buena sesión no dispara un aumento (Principio V).
**Para validar**: usar tres sesiones para ejercicios con mucho ruido (por ejemplo, ejercicios de aislamiento).

## Decisión 3: uso del esfuerzo

**Decisión**: si el esfuerzo promedio de la última sesión es de RPE 9,5 o más, no se sugiere subir el peso aunque se haya llegado al máximo.
**Razón**: la progresión de carga con series al límite suele ser menos sostenible; el umbral es un parámetro documentado y se calibra con uso real. Sin datos de esfuerzo se usa solo el rendimiento y se avisa.

## Decisión 4: no bajar la carga por una sola sesión

**Decisión**: una sesión por debajo del mínimo del rango mantiene el peso; dos seguidas ofrecen una reducción del 5 al 10 % como opción.
**Razón**: una mala sesión puede deberse a sueño, estrés o fatiga puntual; reaccionar a un solo dato viola el Principio V.

## Decisión 5: nada se escribe solo

La sugerencia no modifica el plan ni la sesión; es texto que la persona puede copiar a una serie con un toque («usar»). Ignorarla no deja rastro.

## Decisión 6: sin IA

Toda la lógica es determinista. La explicación («por qué») se arma con plantillas a partir de los números.

## Decisión 7: ejercicios sin carga o por duración

Peso corporal: se progresa por repeticiones y, al superar el máximo, se sugiere añadir una variante o lastre solo como texto informativo. Por duración o distancia: superar el valor anterior en un pequeño paso; sin rango.

## Preguntas que se resuelven al implementar

- Rango por defecto según el objetivo del perfil de atleta (hipertrofia 8–12, fuerza 3–6, otros 8–15); depende de la spec 025.
- Incremento por tipo de equipo (barra 2,5 kg; mancuernas 1–2 kg; máquinas según pila); propuesta: un incremento por ejercicio con el predeterminado de 2,5 kg.


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Regla de carga: subir 2–10 % cuando se logran 1–2 repeticiones sobre el objetivo (ACSM 2009). Confianza: verificado.
- Doble progresión: sin ensayo propio (heurística). APRE (Mann 2010) con n = 23 y 6 semanas; la ventaja puede venir del ajuste constante de repeticiones, no de la autorregulación.
- Incremento 2,5–5 % o el mínimo disponible; si el RIR real es menor al objetivo, mantener o bajar. Decisión de producto.
- Historial mínimo para recomendar (p. ej. ≥3–4 sesiones por ejercicio): heurística propia, declararlo así.
