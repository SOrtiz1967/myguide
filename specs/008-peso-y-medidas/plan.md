# Implementation Plan: Peso y medidas (versión mínima)

**Branch**: `008-peso-y-medidas` | **Spec**: [spec.md](spec.md)

## Resumen

Una tabla (`body_measurements`) con un valor por medida y por día, dos funciones (`save_measurement`, `update_measurement`) y borrado propio por RLS. En el cliente, una pantalla `/medidas` con las últimas medidas, un formulario con borrador local y el historial por tandas; el inicio muestra el último peso. Sin fotos, gráficos ni tendencias.

## Decisiones

1. **Un valor por medida y día** (`unique (user_id, kind, measured_on)`): guardar de nuevo en el mismo día reemplaza; corregir hacia un día ocupado avisa (`date_taken`).
2. **Las escrituras pasan por funciones** `security definer` (dueño y sesión vigente verificados); el cliente solo lee y borra lo propio (patrón de las specs 004 y 006).
3. **Rango y precisión en el servidor**: peso 20–500 kg y demás 10–300 cm, un decimal (`numeric(6,1)`).
4. **«Hoy» según la zona del perfil** (`private.effective_timezone`); versión `*_at` con hora simulada para probar.
5. **Idempotencia** por `client_request_id` único por cuenta; el cliente renueva la solicitud después de cada guardado cumplido.
6. **Borrador local** del formulario de alta con `useDraft` (se borra al cerrar sesión, spec 001).

## Estructura

```text
supabase/migrations/20261026000100_body_measurements.sql
supabase/tests/body_measurements.test.sql
app/src/features/measures/{measures.ts,api.ts,useMeasures.ts,MeasuresPage.tsx}
app/src/features/home/LastRecords.tsx   # último peso
```
