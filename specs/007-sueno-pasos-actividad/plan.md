# Implementation Plan: Sueño, pasos y actividad (registro manual)

**Branch**: `007-sueno-pasos-actividad` | **Spec**: [spec.md](spec.md)

## Resumen

Mismo patrón que la spec 008: una tabla (`daily_activity`) con un valor por tipo, día y fuente; funciones `save_activity` y `update_activity`; borrado propio por RLS. En el cliente, la pantalla `/actividad` (últimos valores, formulario con borrador, historial, corregir, eliminar) y el último sueño en el inicio.

## Decisiones

1. **Almacenamiento en enteros**: minutos para el sueño y la actividad, cantidad para los pasos. El cliente convierte `h:mm` u horas decimales a minutos.
2. **Fuente**: columna `source` (hoy solo `manual`) dentro de la clave única del día; deja la puerta abierta a integraciones sin sumar fuentes distintas.
3. **Escrituras por funciones** `security definer`; el cliente solo lee y borra lo propio.
4. **Idempotencia** por `client_request_id`; el cliente renueva la solicitud tras cada guardado cumplido (lección de la spec 008).
5. **«Hoy»** según la zona del perfil, con versión `*_at` y hora simulada para probar.
