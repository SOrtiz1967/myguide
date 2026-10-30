# Plan de implementación: Recordatorios configurables

**Rama**: `021-recordatorios` | **Fecha**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Resumen

Una tabla chica `reminders` (una fila por cuenta y tipo) guarda la configuración y el «más tarde». El inicio calcula en el navegador qué avisos corresponden con una función pura (`isDue`) y los muestra como tarjetas con «Más tarde» y «Desactivar». La configuración se edita en una sección «Recordatorios» del perfil. La casilla de la spec 016 desaparece y su dato se migra. Sin dependencias nuevas.

## Contexto técnico

- Base de datos: `supabase/migrations/20261030000400_reminders.sql`: tabla con restricciones de frecuencia, RLS de lectura propia, funciones `set_reminder` y `snooze_reminder`, y la migración de `profiles.weight_reminder` (que se elimina).
- Aplicación: `features/reminders/` con `api.ts`, `due.ts` (regla pura), `useReminders.ts`, `ReminderCards.tsx` (inicio) y `RemindersSection.tsx` (perfil). Se quitan la casilla de `GoalProfileForm.tsx` y el aviso suelto de `DayPanel.tsx`; `Profile` pierde `weight_reminder`.
- Datos para calcular: último peso (`fetchLastWeight`), última foto (consulta nueva) y suplementos del día (spec 022).
- Pruebas: pgTAP, Vitest (regla y componentes), Playwright (recorrido, aislamiento, accesibilidad).

## Revisión de la Constitution

| Principio                        | Resultado                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| I (privacidad)                   | Se cumple: RLS con dueño y sesión vigente, escrituras por funciones, sin datos en logs, sin permisos del dispositivo. |
| IV (sin culpa, sin presión)      | Se cumple: tarjeta opcional, una por día, «Más tarde» y «Desactivar», sin contadores ni rachas, texto neutral.        |
| VI (mobile-first, accesibilidad) | Se cumple: tarjetas y formulario operables por teclado, controles de 44 px, axe a 375 y 1280 px.                      |

No hay violaciones que justificar.

## Decisiones de diseño

- **Calcular en el navegador, guardar solo la configuración.** El aviso depende de lo registrado hoy; así no hay trabajos programados ni duplicación de datos. La spec 024 podrá calcular lo mismo en el servidor leyendo esta tabla.
- **Regla `isDue` pura**: recibe la configuración, el día de hoy, la fecha del último registro (o nulo) y si hoy ya hay registro; devuelve verdadero o falso. «Más tarde» se evalúa aparte (`snoozed_until > hoy` oculta).
- **«Más tarde» en la cuenta**, no en el navegador: vale en todos los dispositivos y sobrevive a recargar.
- **Suplementos sin «cada tantos días»** (restricción de tabla y de función).
- **Migración de la casilla** a un recordatorio diario de peso y baja de la columna; se actualizan el tipo `Profile`, el formulario, el panel del día y las pruebas que la mencionaban.
- **Una tarjeta por recordatorio** en el orden peso, fotos, suplementos, arriba de la semana del inicio; si falla, el resto del inicio sigue.

## Estructura de archivos

```text
supabase/migrations/20261030000400_reminders.sql
supabase/tests/{reminders,onboarding_profile}.test.sql
app/src/features/reminders/{api,due,useReminders}.ts
app/src/features/reminders/{ReminderCards,RemindersSection}.tsx
app/src/features/profile/{api.ts,GoalProfileForm.tsx,ProfilePage.tsx}
app/src/features/week/DayPanel.tsx · app/src/routes/HomePage.tsx · app/src/copy/es.ts
app/tests/{unit/reminderDue.test.ts,component/Reminders.test.tsx,e2e/reminders.spec.ts,e2e/week.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de recordatorios (recorrido, aislamiento y accesibilidad), de la semana y del perfil, una parte por vez.
