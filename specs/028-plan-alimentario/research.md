# Investigación: Plan alimentario por día y actividad

## Decisión 1: generador determinista, sin IA

**Decisión**: resolver el plan con un algoritmo propio sobre valores del catálogo.
**Razón**: Principio III y el documento de origen («la IA no debería ser necesaria para cálculos nutricionales deterministas»); los totales deben poder probarse contra cálculos a mano. La IA queda como mejora futura solo para sugerir combinaciones, siempre validadas y recalculadas por el sistema.

## Decisión 2: variación entre días sin compensar

**Decisión**: el objetivo de energía es un promedio semanal. Días de entrenamiento suman +5 % (carbohidratos); días de descanso restan lo necesario para que el promedio semanal sea igual al objetivo.
**Razón**: Principio IV. No hay «premio» ni «castigo»: la diferencia sale del modelo, es simétrica en la semana y el plan de un día no depende del consumo del anterior.
**Para validar**: la magnitud (+5 %) y si conviene un +10 % en entrenamiento intenso. Revisar con la literatura sobre periodización de carbohidratos (por ejemplo, el consenso de la ISSN sobre momento de nutrientes, 2017) antes de implementar; hasta entonces el valor es un parámetro de configuración documentado, no una verdad.

## Decisión 3: reparto entre comidas

**Decisión**: porcentajes predeterminados por cantidad de comidas, ajustables por la persona. Más carbohidratos en las comidas alrededor del entrenamiento si la persona indica el horario.
**Razón**: la evidencia sobre distribución de proteína sugiere repartirla en varias comidas, pero sin un único «número correcto»; por eso el reparto es una propuesta editable.

## Decisión 4: clasificación de alimentos por macro dominante

**Decisión**: un alimento es «proteico», «de carbohidrato» o «graso» según qué macro aporta más energía por 100 g; los mixtos (ni uno supera el 50 %) se tratan como «mixtos» y se pueden usar solo como complemento.
**Razón**: el catálogo no tiene categorías de grupo alimentario; usar los valores nutricionales evita depender de datos que no existen y es verificable.

## Decisión 5: tolerancia y límites del solver

Objetivo por comida ±10 % en energía y ±15 % en cada macro. Si no se alcanza con los candidatos, se muestra la desviación y su motivo (por ejemplo «sin fuente de proteína disponible»). Cantidades en pasos prácticos (5 g; porciones del alimento).

## Decisión 6: presupuesto

**Decisión**: preferencia declarada, sin precios.
**Razón**: el catálogo no tiene precios y no hay fuente abierta confiable para Argentina; inventar costos violaría el principio de no mostrar más precisión que la que hay.

## Decisión 7: lista de compras

Derivada, no persistida. Se suman cantidades de los planes confirmados de 1 a 14 días y se redondean hacia arriba al paso práctico. Los alimentos sin `food_id` (eliminados) se agrupan por nombre de la instantánea.

## Preguntas que se resuelven al implementar

- Cuántos alimentos candidatos mínimos se necesitan para generar un plan útil (propuesta: 3 proteicos, 3 de carbohidrato y 2 grasos); con menos, se pide completar la lista de disponibles.
- Si la comida «pre-entreno» necesita un tratamiento especial (propuesta: solo más carbohidratos y menos grasa).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- **Decisión revisada**: el +5 % de energía en días de entrenamiento NO tiene respaldo directo. Coste de una sesión de fuerza 3,5–6,0 MET (Compendium 2011) y la periodización por tipo de día se estudió sobre todo en resistencia (Impey 2018). Queda **desactivado por defecto**, opcional y etiquetado como heurística; no presentarlo como evidencia.
- Proteína por comida: orientación suave 0,25–0,4 g/kg por toma en ≥4 tomas (Schoenfeld y Aragon 2018); la «ventana anabólica» estrecha carece de respaldo (Aragon y Schoenfeld 2013). Nunca como límite.
- Tolerancias ±10 % y ±15 % por comida: decisión de producto, sin fuente.
