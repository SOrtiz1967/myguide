# Plan: Rediseño con semana en el inicio

**Spec**: `specs/016-rediseno-semana/spec.md`

Migración `20261027000200_weight_reminder.sql` (`profiles.weight_reminder`, apagado por defecto, con `GRANT UPDATE` de la columna). Resto, solo frontend:

- Tema: tokens en `app/src/index.css` (negro y azul, un solo tema oscuro; `--color-warn` ocre para «por encima del rango»; `--color-mark` para marcas de gráficos); tipografía Schibsted Grotesk Variable (`@fontsource-variable`), cifras tabulares.
- Carcasa: `components/AppShell.tsx` y `NavIcon.tsx`. Menú lateral en `lg`, barra inferior fija con «Más» en celular; la sección actual con `aria-current`; sin consultas de datos.
- Semana: `features/week/` (`week.ts` con estados y tolerancia, `useWeek.ts`, `WeekStrip.tsx`, `DayBullet.tsx`, `Glyph.tsx`, `DayPanel.tsx`). Consultas por rango nuevas: `fetchEntriesBetween` (comidas) y `fetchWeightsBetween` (peso).
- Inicio: `routes/HomePage.tsx` compone semana, panel del día y últimos registros; `CaloriesBlock` acepta un día y `TrainingBlock` se usa solo para hoy.
- Perfil: `GoalProfileForm` suma «Recordarme pesarme».

Pruebas: `week.test.ts`, `WeekStrip.test.tsx`, `HomeBlocks.test.tsx` adaptado, pgTAP `onboarding_profile` (recordatorio), e2e `week.spec.ts`; el resto de los e2e se adaptó donde dependían de listas o enlaces del menú (`getByRole('main')`, helper `logout`).
