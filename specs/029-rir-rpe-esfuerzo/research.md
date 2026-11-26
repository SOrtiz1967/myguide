# Investigación: RIR/RPE y esfuerzo por serie

## Hallazgo: ya existe un esfuerzo por ejercicio

`session_exercises.effort` (1 a 10) y su selector `EffortSelect` están en la spec 006 y los consume la spec 012. No es lo mismo que el esfuerzo por serie: describe el ejercicio completo. Se conserva.

## Decisión 1: guardar RPE y derivar RIR

**Decisión**: una sola columna `effort_rpe` (1,0 a 10,0 en pasos de 0,5). RIR = 10 − RPE.
**Fuentes a verificar**: Zourdos et al. (2016), escala RPE basada en repeticiones en reserva para sentadilla; Helms et al. (2016), aplicación de RIR y RPE en entrenamiento de fuerza. Ambas definen la equivalencia que se usa aquí.
**Razón**: una escala ordenada y acotada permite comparar series y calcular promedios sin convertir en cada consulta; RIR se muestra por conversión.
**Alternativa descartada**: guardar la escala elegida y el valor tal cual (obliga a convertir en cada comparación y complica los cambios de preferencia).

## Decisión 2: límites

RPE 1,0 a 10,0 en pasos de 0,5; RIR 0 a 9 al cargar (RIR 10 equivaldría a RPE 0). Se informa el ajuste respecto del texto original de la spec.

## Decisión 3: aviso sobre la fiabilidad

El RIR es una estimación subjetiva que suele subestimar la reserva real, sobre todo con muchas repeticiones o con poca experiencia. La app lo presenta como esfuerzo percibido (no medido) y no lo usa para afirmaciones fuertes.

## Decisión 4: series viejas

No se completan. `null` significa «sin dato» en toda la app.

## Decisión 5: no se copia el esfuerzo

Duplicar una sesión o crearla desde una rutina deja el esfuerzo vacío: es un dato de lo que ocurrió.

## Preguntas que se resuelven al implementar

- Si el selector debe ofrecer medios puntos de RPE (propuesta: sí en RPE, no en RIR).
- Valor por defecto del selector al abrirlo (propuesta: ninguno; recordar el último usado en la sesión).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- RPE = 10 − RIR validado contra velocidad de barra (Zourdos 2016, n = 29; r = −0,88 / −0,77). La tabla completa de la escala no se leyó.
- Se subestima en promedio 0,95 repeticiones hasta el fallo; el error crece con la distancia al fallo y las series largas (Halperin 2022; Zourdos 2021: error 5,15 reps en RPE 5, 2,05 en RPE 9). Sin evidencia primaria para RIR 5–9.
- **Decisión revisada**: aceptar RIR 0–9 al registrar (compatibilidad), pero presentar RIR 0–4 (RPE 6–10) como rango fiable; RIR >4 como «ligero/impreciso»; copy «±1 repetición»; el fallo es opcional (Refalo 2023: ventaja trivial, ES 0,19).
