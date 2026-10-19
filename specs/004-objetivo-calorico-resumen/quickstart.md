# Quickstart: validar la spec 004

**Feature**: 004-objetivo-calorico-resumen

## Requisitos previos

Los de las specs 001 a 003: Docker Desktop, `npx supabase start`, frontend en marcha y el catálogo de desarrollo cargado (`npm run import:muestra`). Esta spec no agrega funciones de borde: no hace falta `functions serve` para probarla.

```powershell
npx supabase migration up                     # o db reset + import:muestra
npm run dev --prefix app
```

## Comandos de verificación

```powershell
npm run test:db          # pgTAP: historial, función de escritura, RLS e idempotencia
npm test --prefix app    # Vitest: resolución del objetivo, resumen, lenguaje, formulario y tarjeta
npm run e2e --prefix app # Playwright (por partes si falta memoria)
npm run check:secrets --prefix app
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Cuenta sin objetivo abre un día con ítems | 1 | Se ve lo registrado y la invitación a fijar un objetivo; **ni** restantes, **ni** porcentaje, **ni** barra |
| 2 | Fijar 2.000 kcal | 1 | Mensaje "Objetivo guardado. Rige desde hoy."; el día muestra el objetivo |
| 3 | Escribir 999, 6.001, vacío, "abc" y "1800,5" | 1 | Cada uno se rechaza con su mensaje; no se guarda nada |
| 4 | Escribir "2.000" y "2000,0" | 1 | Ambos se guardan como 2.000 |
| 5 | Doble clic en "Guardar objetivo" | 1 | Una sola entrada en el historial |
| 6 | Cortar la red al guardar | 1 | Aviso de que no se guardó; el valor escrito se conserva; reintentar funciona |
| 7 | Recargar con el formulario a medias | 1 | El borrador vuelve; cerrar sesión lo borra |
| 8 | Objetivo 2.000 y 1.350 kcal registradas | 2 | "Restan 650 kcal", la cuenta "2.000 − 1.350 = 650 kcal" y "68 % del objetivo" |
| 9 | Agregar, editar, mover y eliminar un ítem con el resumen visible | 2 | Las cifras se actualizan al instante |
| 10 | Ir al día anterior y volver | 2 | Cada día muestra su total y el objetivo que regía ese día |
| 11 | Día vacío con objetivo | 2 | 0 registradas; el objetivo completo como restante; sin tono de fallo |
| 12 | A la 01:00 con el día que se cierra | 2 | El resumen es el del día que se cierra, con su fecha visible |
| 13 | Un ítem sin dato de energía | 3 | "Restan como máximo…" y cuántos ítems faltan |
| 14 | Un ítem estimado sin confirmar (sembrado por SQL) | 3 | Entra en lo registrado y se muestra aparte con su aclaración |
| 15 | Todos los ítems con energía y confirmados | 3 | Ninguna aclaración de incertidumbre |
| 16 | Abrir "Cómo se calcula" | 3 | Fórmula e ítems incluidos y excluidos, en lenguaje simple |
| 17 | Registrar 2.250 con objetivo 2.000 | 4 | "Registraste 250 kcal más que el objetivo de este día." sin sugerencias, sin color de error ni íconos de advertencia, y ningún término prohibido en el texto de la tarjeta y de la pantalla del objetivo (no se revisan los nombres que escribe la persona) |
| 18 | Registrar exactamente 2.000 | 4 | "Restan 0 kcal", sin frase de exceso |
| 19 | Fijar 1.100 kcal | 4 | Se guarda y se ve la nota informativa sobre consultar a un profesional |
| 20 | Superar el objetivo varios días seguidos | 4 | El objetivo no cambia y no aparece ningún aviso, racha ni castigo |
| 21 | Cambiar de 2.000 a 1.800 | 5 | Hoy usa 1.800; los días anteriores siguen mostrando 2.000 |
| 22 | Cambiar dos veces el mismo día | 5 | Rige el último valor guardado |
| 23 | Quitar el objetivo y volver a fijarlo | 5 | Desde hoy sin objetivo; los días anteriores conservan el suyo; al volver a fijarlo rige desde ese día |
| 24 | Días anteriores a la primera vez que se fijó un objetivo | 5 | Solo lo registrado |
| 25 | Una fecha futura cercana (hasta 7 días) | 5 | Muestra el objetivo vigente hoy |
| 26 | Cambiar la zona horaria del perfil | 5 | Los días ya vividos conservan su objetivo |
| 27 | Cambiar el objetivo a la 01:00 mientras se registra el día que se cierra | 5 | Rige desde el día nuevo; el día que se cierra conserva el valor anterior |
| 28 | La cuenta B intenta leer o cambiar el objetivo de A (tablas, función y petición anónima) | todas | No ve ni cambia nada |
| 29 | Un día con 60 ítems y objetivo, en un teléfono | 2 | El día completo, con resumen, carga en menos de 2 s |
| 30 | Teléfono y escritorio con lector de pantalla y teclado | todas | Sin desplazamiento horizontal; axe sin problemas graves; el estado se entiende sin color |
| 31 | Cerrar sesión y entrar con otra cuenta en la misma pestaña | todas | La segunda cuenta no ve el objetivo ni los ítems de la primera, ni siquiera mientras carga |

## Criterio de terminado

Todos los comandos de verificación pasan y los 31 escenarios se cumplen.
