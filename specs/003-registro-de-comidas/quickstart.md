# Quickstart: validar la spec 003

**Feature**: 003-registro-de-comidas

## Requisitos previos

Los de las specs 001 y 002: Docker Desktop, `npx supabase start`, funciones y frontend en marcha, y el catálogo de desarrollo cargado (`npm run import:muestra`).

```powershell
npx supabase migration up                     # o db reset + import:muestra
npx supabase functions serve --env-file supabase/.env.local
npm run dev --prefix app
```

## Comandos de verificación

```powershell
npm run test:db          # pgTAP: ítems, instantánea, regla del día, repetir, fotos y RLS
npm run test:functions   # Deno: meal-photo (limpieza de metadatos, validaciones, permisos)
npm test --prefix app    # Vitest: totales, formularios, vista del día
npm run e2e --prefix app # Playwright (por partes si falta memoria)
npm run check:secrets --prefix app
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Agregar "Arroz blanco cocido, 150 g" al almuerzo | 1 | Ítem con valores para 150 g y "Del catálogo" |
| 2 | Agregar "1,5 tazas" de un alimento con porciones | 1 | Cantidad equivalente en gramos y la porción visible |
| 3 | Agregar un alimento sin dato de fibra | 1 | Fibra "sin dato" en el ítem; total de fibra marcado como incompleto |
| 4 | Doble clic en "Agregar" | 1 | Un solo ítem |
| 5 | Cortar la red al agregar | 1 | Aviso de que no se guardó; borrador conservado |
| 6 | Volver a registrar un reciente | 1 | Aparece con su última cantidad; se registra en 2 toques |
| 7 | Ver el día con dos comidas | 2 | Subtotales por comida y total del día con unidades |
| 8 | Ir al día anterior y volver a "Hoy" | 2 | Cada día muestra solo lo suyo |
| 9 | Día sin registros | 2 | Estado vacío con "Agregar" |
| 10 | Entrada manual "Torta, 350 kcal" | 3 | Ítem "Manual"; macronutrientes "sin dato" |
| 11 | Entrada manual con valores imposibles | 3 | Rechazo con mensaje claro |
| 12 | Guardar una entrada manual como alimento propio | 3 | Aparece en "Mis alimentos"; el ítem no cambia |
| 13 | Cambiar la cantidad de 100 g a 200 g | 4 | Valores duplicados desde la instantánea |
| 14 | Mover un ítem a la cena y a otro día | 4 | Desaparece del origen y aparece en el destino |
| 15 | Eliminar un ítem (cancelar y confirmar) | 4 | Solo se elimina al confirmar |
| 16 | Editar y eliminar el alimento de un ítem ya registrado | 4 | El ítem conserva nombre y valores; avisa que el alimento ya no está |
| 17 | Registrar a la 01:00 sin nada en el día nuevo | 5 | Se propone el día que se cierra, con la fecha visible |
| 18 | "Empezar el día de hoy" | 5 | Lo siguiente se propone en el día nuevo |
| 19 | Cambiar la zona horaria del perfil | 2, 5 | Los ítems no cambian de día |
| 20 | Repetir el desayuno de ayer en hoy | 6 | Mismos ítems; recalculados si el alimento cambió; el de ayer intacto |
| 21 | Doble clic en "Repetir" | 6 | Los ítems se crean una sola vez |
| 22 | Adjuntar una foto con GPS en su EXIF | 7 | La foto guardada no tiene metadatos y pesa menos |
| 23 | Otra cuenta o una petición anónima pide la foto | 7 | Acceso denegado |
| 24 | Reemplazar y eliminar la foto | 7 | La anterior deja de estar disponible |
| 25 | Subir un archivo que no es imagen o de más de 15 MB | 7 | Rechazo con mensaje claro |
| 26 | Otra cuenta intenta leer o modificar mis ítems | todas | No ve ni cambia nada |
| 27 | Día con 60 ítems en un teléfono | 2 | Se muestra en menos de 2 s; totales correctos |

## Criterio de terminado

Todos los comandos de verificación pasan y los 27 escenarios se cumplen.
