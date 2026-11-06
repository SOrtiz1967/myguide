# Tareas: Rediseño de la interfaz

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [direccion-visual.md](direccion-visual.md). Las rutas son relativas a la raíz del repositorio.

Formato: `- [ ] Txxx [P] [USn] descripción con ruta`. `[P]` marca tareas que se pueden hacer en paralelo (archivos distintos).

## Fase 1: Preparación

- [x] T001 Crear `specs/017-redisenio-interfaz/direccion-visual.md` con la dirección C elegida por el autor (US1).
- [x] T002 Instalar la tipografía Manrope (`@fontsource-variable/manrope`) en `app/package.json` e importarla en `app/src/main.tsx` en lugar de Schibsted Grotesk.

## Fase 2: Base común (bloquea las historias de usuario)

- [x] T003 [US2] Definir los tokens de la dirección C (colores, tonos, radios, tipografía) en `app/src/index.css` conservando los nombres de token existentes.
- [x] T004 [US2] Escribir en `app/src/index.css` las clases del sistema: `card` y tonos, `control`, `btn-primary`, `btn-secondary`, `btn-quiet`, `chip`, `chip-selected`, `list-row`.
- [x] T005 [P] [US2] Crear `app/src/components/Card.tsx` y `app/src/components/PageHeader.tsx`.
- [x] T006 [P] [US2] Crear `app/src/components/StatusTag.tsx` (forma + texto) reutilizando los glifos de `app/src/features/week/Glyph.tsx`.
- [x] T007 [P] [US2] Crear `app/src/components/Meter.tsx` (barra con rango y cifras en texto, sin color como único dato).
- [x] T008 [US2] Rehacer `Field.tsx`, `CheckboxField.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`, `SuccessMessage.tsx`, `OfflineNotice.tsx` y `OriginTabs.tsx` en `app/src/components/` con las clases del sistema, sin cambiar sus propiedades ni su comportamiento.
- [x] T009 [US2] Crear la página de referencia `app/src/routes/DesignSystemPage.tsx`, registrarla como `/sistema` en `app/src/routes/index.tsx` (con sesión) y mostrar cada pieza en todos sus estados.
- [x] T010 [P] [US2] Prueba de contraste de los pares de color de los tokens en `app/tests/unit/contrast.test.ts` (texto ≥ 4,5:1; contorno de campos ≥ 3:1).
- [x] T011 [P] [US2] Pruebas de componentes de las piezas nuevas en `app/tests/component/DesignSystem.test.tsx`.

## Fase 3: Historia 4 — Navegación coherente (P2, pero la carcasa es base de las pantallas)

- [x] T012 [US4] Rehacer `app/src/components/AppShell.tsx`: columna de íconos con nombre visible en escritorio, barra inferior flotante en celular, mismo orden y nombres, sin menú en `/bienvenida`.
- [x] T013 [US4] Actualizar `app/src/components/NavIcon.tsx` con los íconos que falten y mantener `aria-current` en la sección actual.
- [x] T014 [US4] Verificar que registrar comida, empezar entrenamiento y registrar peso se alcanzan desde el inicio en dos toques o menos (FR-010) y ajustar los accesos del inicio si hace falta.

## Fase 4: Historia 3 — Pantallas con el sistema nuevo (P1)

- [x] T015 [US3] Rehacer el inicio: `app/src/routes/HomePage.tsx`, `app/src/features/week/WeekStrip.tsx`, `DayBullet.tsx`, `DayPanel.tsx`, `app/src/features/home/TrainingBlock.tsx` y `LastRecords.tsx` en mosaico de bloques con tonos.
- [x] T016 [P] [US3] Registro, inicio de sesión, recuperación y primer ingreso: `app/src/features/auth/*` y `app/src/features/onboarding/*`.
- [x] T017 [P] [US3] Comidas: `app/src/features/meals/*`.
- [x] T018 [P] [US3] Alimentos: `app/src/features/foods/*`.
- [x] T019 [P] [US3] Ejercicios: `app/src/features/exercises/*`.
- [x] T020 [P] [US3] Entrenamiento (solo piezas comunes): `app/src/features/training/*`.
- [x] T021 [P] [US3] Actividad, medidas, objetivo, plan y perfil: `app/src/features/activity/*`, `measures/*`, `goals/*`, `plan/*`, `profile/*`.
- [x] T022 [US3] Cambiar en `app/index.html` y en el manifiesto el color de tema y de fondo por el de la dirección C (FR-020).

## Fase 5: Historia 5 — Estados uniformes (P2)

- [x] T023 [US5] Reemplazar los avisos de error o de vacío sueltos por `ErrorState`, `EmptyState` y `LoadingState` en todas las pantallas (buscar `border-danger/40` y bloques de texto vacío en `app/src/features`).

## Fase 6: Cierre y verificación

- [x] T024 Buscar estilos sueltos (hexadecimales y tamaños en píxeles fuera de `app/src/index.css`) en `app/src` y eliminarlos (SC-002).
- [x] T025 [P] Prueba de accesibilidad con axe en `app/tests/e2e/a11y-system.spec.ts` sobre `/sistema`, inicio y una pantalla de formulario, a 375 px y a 200 % de zoom.
- [x] T026 Correr lint, formato, typecheck y la suite completa de Vitest; leer el resultado.
- [x] T027 Correr Playwright una parte por vez y leer el resultado. Suite completa corrida el 2026-11-06: 292 de 292 pasan.
- [x] T028 Actualizar `Documentacion/roadmap-specs.md` y `README.md` con el estado de la spec 017 y commitear.

## Dependencias

- Fase 2 antes de las fases 3 a 5. T012 antes de T015. T015 a T021 pueden ir en paralelo entre sí una vez hecha la Fase 2 y T012.
- T023 después de T015–T021. T024 a T028 al final.

## Estrategia

Primero la base (tokens, clases y piezas) y la carcasa, porque cambian la apariencia de todas las pantallas a la vez; después el inicio, que es el que el autor más ve; después el resto en lotes por feature, corriendo las pruebas de componentes de cada lote antes de seguir.

## Estado (2026-10-28)

Hecho: T001 a T026. La suite de Vitest (1151 pruebas), typecheck, lint, formato y la prueba de accesibilidad con axe de T025 (375 y 1280 px) pasan. Pendiente: T027, la suite completa de Playwright, cuya corrida de escritorio se interrumpió por falta de memoria de la máquina y no se reinició; y T028, la actualización final de roadmap y README después de esa corrida. Los estilos de T015 a T021 se aplicaron con las clases y componentes del sistema; la revisión visual con capturas cubrió inicio, comidas, agregar comida, medidas y la página `/sistema`.
