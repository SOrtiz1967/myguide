# Implementation Plan: Registro de comidas

**Branch**: `003-registro-de-comidas` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-registro-de-comidas/spec.md`

## Summary

Registrar lo comido cada día, por comida (desayuno, almuerzo, merienda, cena, colación), desde el catálogo y los alimentos propios de la spec 002 o con una entrada manual. Cada ítem guarda una instantánea inmutable de los valores del alimento. La vista del día muestra subtotales y totales que marcan los faltantes. Además: recientes, corregir, mover, eliminar y repetir comidas; la regla del día que se está cerrando; y una foto opcional por comida, sin metadatos y privada.

Enfoque técnico (detalle y alternativas en [research.md](research.md)):

- Una tabla `meal_entries` con instantánea y valores calculados por un disparador.
- Escrituras por funciones SQL atómicas e idempotentes (`add_meal_entry`, `update_meal_entry`, `repeat_meal`).
- La regla del día en la función `log_day_status`.
- Recientes en la función `recent_meal_items`.
- Totales con funciones puras en el cliente.
- Fotos: se reducen y se vuelven a codificar en el navegador, y una Edge Function `meal-photo` les **quita los metadatos en el servidor** antes de guardarlas en un bucket privado. Se ven con URLs firmadas de corta duración.

No hay dependencias nuevas de frontend ni servicios externos.

## Technical Context

**Language/Version**: TypeScript estricto (frontend y Edge Function en Deno), SQL (Postgres 17 de Supabase)

**Primary Dependencies**: las de las specs 001 y 002. Supabase Storage (incluido en el plan gratuito). Ninguna biblioteca de imágenes: el navegador reduce con `createImageBitmap` y `canvas`, y la función limpia el JPEG recorriendo sus segmentos.

**Storage**: Postgres (`meal_entries`, `log_day_starts`, `meal_photos`); Supabase Storage, bucket privado `meal-photos`. Presupuesto de fotos: unas 500 KB por foto, del orden de 2 por día, unos 365 MB por año para una persona, dentro de 1 GB de Storage gratuito por unos 2,5 años. Queda anotado como riesgo.

**Testing**:

- pgTAP: instantánea, cálculo, idempotencia, regla del día con distintas zonas horarias, recientes, repetir, RLS y Storage.
- Deno: limpieza de JPEG, validaciones y permisos de `meal-photo`.
- Vitest y Testing Library: totales, formularios, vista del día, recientes y foto.
- Playwright y axe: flujos, accesibilidad, responsive y sin servicios de terceros.

**Target Platform**: la misma PWA (navegadores modernos; HEIC solo donde el navegador lo decodifique)

**Project Type**: aplicación web (SPA y backend gestionado)

**Performance Goals**: un día con hasta 60 ítems se muestra en menos de 2 s en un teléfono con conexión típica (SC-002); agregar un reciente en 2 interacciones (SC-001); la foto de 12 MP queda en menos de 500 KB y la función responde en menos de 2 s

**Constraints**:

- La instantánea es inmutable; un faltante nunca es 0.
- El día queda fijado al guardar.
- No hay registro sin conexión.
- Ninguna foto llega a Storage sin pasar por la limpieza del servidor.
- Nada de IA (spec 009).

**Scale/Scope**: una persona; unos 10 a 20 ítems por día, decenas de miles en varios años; 4 pantallas nuevas y un enlace de cabecera

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).* Evaluado contra la Constitution v1.2.1.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | Ítems y fotos privados con RLS y pruebas de aislamiento. Fotos en un bucket privado, sin listado, legibles solo por su dueño con sesión vigente y por URL firmada de 10 minutos. Metadatos EXIF y otros **quitados en el servidor** aunque el navegador ya los quite. Cifrado en reposo del proveedor, documentado. La clave de servicio solo en la Edge Function. Las fotos no se envían a ningún servicio externo. | ✅ Cumple |
| **II. Integridad e idempotencia** | Instantánea inmutable por ítem; los valores se recalculan desde la instantánea, nunca desde el alimento actual; `food_id` con `on delete set null`. Altas y repeticiones idempotentes (`client_request_id`, también derivado al repetir). La regla del día y "Empezar el día de hoy" implementan el corte a las 00:00 con imputación flexible. El día no se mueve al cambiar la zona horaria. Origen y estado visibles (manual, del catálogo, propio; estimado reservado). | ✅ Cumple |
| **III. Estimaciones transparentes** | Registro sin foto; entrada manual sin depender del catálogo ni de la IA; los faltantes se muestran y los totales se marcan como incompletos; precisión acotada; aviso de coherencia de energía y macronutrientes. | ✅ Cumple |
| **IV. Lenguaje no coercitivo** | Los totales no se comparan con un objetivo ni se califican (sin "bien" ni "mal"); los mensajes son neutros. | ✅ Cumple |
| **VI. Experiencia** | Pocos pasos (recientes, repetir), responsive, en español, estados definidos, borradores locales, guardado confirmado y foto comprimida en el navegador. No depende de integraciones externas. Sin conexión no se registra. | ✅ Cumple |
| **VII. Arquitectura** | Cálculo de totales y validaciones puros y probados; la base y la función reimponen las validaciones del cliente; sin dependencias nuevas. | ✅ Cumple |
| **VIII. Calidad y SDD** | TDD en cada tarea; 27 escenarios en `quickstart.md`; prototipos de los tres riesgos antes de construir. | ✅ Cumple |
| **IX. Observabilidad** | La función de fotos registra solo resultado, tamaño y duración, sin identificadores personales ni contenido. | ✅ Cumple |
| **X. Catálogos** | Se usa el catálogo de la spec 002 sin modificarlo; la instantánea conserva la procedencia (nombre y marca registrados). | ✅ Cumple |

**Resultado**: sin violaciones.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado. El guardián `rls_guardrail` cubre las tablas nuevas sin cambios, porque todas tienen `user_id`. La prueba de claves foráneas de la spec 002 valida `meal_entries.food_id`.

## Project Structure

### Documentation (this feature)

```text
specs/003-registro-de-comidas/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-api.md      # funciones RPC y acceso a tablas
│   ├── meal-photo.md        # Edge Function de fotos
│   └── ui-routes.md         # rutas, estados y accesibilidad
├── checklists/requirements.md
└── tasks.md                 # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/src/features/meals/
├── api.ts                   # add/update/delete, día, recientes, repetir, fotos
├── schema.ts                # Zod: cantidad, porción, entrada manual (mismas reglas que la base)
├── mealTotals.ts            # funciones puras: subtotales, total, "incompleto"
├── meals.ts                 # comidas (orden, etiquetas) y fechas del día
├── photo.ts                 # reducir y volver a codificar en el navegador
├── useDay.ts                # ítems del día, estado del día propuesto
├── DayPage.tsx              # vista del día
├── MealSection.tsx          # una comida con sus ítems, subtotal, foto y acciones
├── AddEntryPage.tsx         # recientes, búsqueda y entrada manual
├── QuantityPicker.tsx       # g/ml o porciones
├── EntryDetailPage.tsx      # detalle, edición, eliminar, guardar como alimento propio
└── MealPhoto.tsx            # subir, ver, reemplazar, eliminar
app/tests/{unit,component,e2e}/

supabase/migrations/         # tablas, RLS, disparador, funciones, bucket y políticas de Storage
supabase/tests/              # pgTAP del registro de comidas
supabase/functions/meal-photo/
├── index.ts
├── jpeg.ts                  # recorrido y limpieza de segmentos (puro y probado)
└── jpeg.test.ts
```

**Structure Decision**: se agrega `features/meals` al frontend y una Edge Function. La búsqueda de alimentos se reutiliza de `features/foods`. `nutrition.ts` (spec 002) se reutiliza para el formato y la coherencia.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Edge Function para subir fotos en lugar de subir directo a Storage | El Principio I exige quitar los metadatos **en el servidor** antes de almacenar | La subida directa deja que un archivo sin limpiar llegue al bucket |
| Tabla `log_day_starts` | Recordar la decisión explícita "Empezar el día de hoy" sin tocar el perfil de la spec 001 | Una columna en `profiles` obliga a ampliar sus permisos por columna y mezcla responsabilidades |

## Riesgos y verificaciones previas a implementar

1. **P1, limpieza de JPEG en la Edge Function** (research, Decisión 7): no debe quedar ningún APP1, APP13 ni COM, la imagen debe seguir válida y la función debe tardar menos de 1 s.
2. **P2, decodificación en el navegador y HEIC**: qué formatos decodifica cada navegador y tamaño final de una foto de 12 MP.
3. **P3, Storage privado en local**: URL firmada para la persona dueña; acceso denegado a otra cuenta y a anónimos; la URL firmada vence.
4. **Espacio de fotos**: unos 365 MB por año. Si se acerca al límite, se reduce la calidad o se ofrece borrar fotos viejas (spec futura).
5. **Zonas horarias**: pruebas con distintas zonas y el paso por la medianoche, con la hora simulada.
