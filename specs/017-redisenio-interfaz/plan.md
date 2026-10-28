# Plan de implementación: Rediseño de la interfaz

**Rama**: `017-redisenio-interfaz` | **Fecha**: 2026-10-28 | **Spec**: [spec.md](spec.md) | **Dirección**: [direccion-visual.md](direccion-visual.md) (C, Bloques)

## Resumen

Se reemplaza la apariencia de toda la aplicación sin tocar funciones ni datos. El trabajo se hace de abajo hacia arriba: primero los valores comunes (tokens) y las piezas del sistema, después la carcasa y la navegación, después el inicio, y por último el resto de las pantallas, que reciben el sistema mediante clases y componentes compartidos. La dirección elegida es C: bloques redondeados sobre un fondo casi negro, un tono propio por tema, columna de íconos en escritorio y barra inferior en celular.

## Contexto técnico

- Lenguaje y herramientas: TypeScript, React 19, Tailwind 4 con tokens en `@theme`, sin dependencias nuevas salvo la tipografía **Manrope** (paquete `@fontsource-variable/manrope`, alojada en el propio sitio, sin pedir nada a terceros).
- Datos: no hay cambios. No se agregan tablas, columnas, funciones ni servicios (FR-018).
- Pruebas: las de Vitest y Playwright existentes son la red de seguridad; cambia el código de presentación, no el comportamiento (FR-017). Se agregan pruebas de las piezas nuevas y de la página de referencia.
- Alcance de plataforma: PWA instalable; el color de tema y de fondo del manifiesto se actualizan al fondo nuevo (FR-020).

## Revisión de la Constitution

| Principio                                         | Resultado                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| III, VI (accesibilidad, mobile-first, uso simple) | Se cumple: foco visible, contraste AA verificado por token, tamaños táctiles mínimos de 44 px, sin desborde a 375 px. |
| IV (reporte neutral, sin juicio)                  | Se cumple: estados con texto y forma; ningún rojo ni verde como juicio sobre calorías, peso o rendimiento.            |
| X (fuentes y licencias)                           | Manrope se distribuye con licencia abierta (OFL) y se aloja en el sitio.                                              |
| Demás principios (privacidad, datos, IA, fotos)   | No se tocan: no hay datos nuevos ni servicios externos.                                                               |

No hay violaciones que justificar.

## Decisiones de diseño

### Valores comunes (tokens)

Se mantienen los nombres de token existentes para que las pantallas no cambien de clase, y se agregan los de bloques.

| Token                                               | Valor                                         | Uso                                                                      |
| --------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| `--color-bg`                                        | `#090c12`                                     | fondo de la aplicación                                                   |
| `--color-surface`                                   | `#121923`                                     | bloque base (tarjeta)                                                    |
| `--color-surface-2`                                 | `#1a2638`                                     | elemento elevado dentro de un bloque, selección                          |
| `--color-surface-3`                                 | `#0f1520`                                     | elemento inactivo o no disponible                                        |
| `--color-ink` / `--color-muted` / `--color-mark`    | `#e9f0ff` / `#a8b8d4` / `#62718a`             | texto principal, secundario y marcas                                     |
| `--color-line`                                      | `#2c3a52`                                     | contorno de campos y separadores                                         |
| `--color-accent` / `--color-accent-ink`             | `#4f8dff` / `#04101f`                         | acción principal y selección                                             |
| `--color-tone-calorie` (+ `-ink`, `-deep`, `-bar`)  | `#10203a` / `#a8c8ff` / `#0a1630` / `#6aa2ff` | bloque de calorías y comidas                                             |
| `--color-tone-training` (+ `-ink`)                  | `#1b1838` / `#c3bdf5`                         | bloque de entrenamiento                                                  |
| `--color-tone-body` (+ `-ink`)                      | `#0d2a30` / `#9fdde6`                         | bloque de peso y medidas                                                 |
| `--color-warn`, `--color-danger`, `--color-success` | se conservan                                  | solo para errores técnicos y confirmaciones de acción, nunca como juicio |
| `--radius-md` / `--radius-lg` / `--radius-xl`       | `0.875rem` / `1rem` / `1.5rem`                | campos y botones, elementos internos, bloques                            |

Los contrastes se verifican con una prueba automática de los pares de color (texto sobre fondo ≥ 4,5:1; contornos de campos ≥ 3:1).

### Piezas del sistema

Clases compartidas en `app/src/index.css` (capa de componentes) y componentes React en `app/src/components/`:

- `Card` (clase `card`, con variantes de tono `calorie`, `training`, `body`) para bloques; `PageHeader` para el encabezado de cada pantalla (título, subtítulo y acción opcional).
- `control` (clase para `input`, `select`, `textarea`), `Field` actualizado, `CheckboxField` actualizado.
- Botones `btn-primary`, `btn-secondary` y nuevo `btn-quiet`, más `chip` y `chip-selected` para filtros y pestañas de origen.
- `StatusTag` (forma + texto) para los estados de día, calorías y entrenamiento; reutiliza los glifos de la semana (●, ▽, ◔, ■, □).
- `EmptyState`, `LoadingState`, `ErrorState`, `SuccessMessage` y `OfflineNotice` rehechos con las clases anteriores.
- `Meter` (barra con rango objetivo y cifras en texto) como pieza de gráfico para calorías; sirve de base a las specs 010, 012 y 020.
- Página de referencia interna `/sistema` que muestra cada pieza en todos sus estados.

### Carcasa y navegación

- Escritorio: columna de íconos de 88 px con el nombre de cada sección visible bajo el ícono; el perfil al pie; las secciones del primer nivel y las de «Más» como hoy, pero en un panel desplegable de la misma columna.
- Celular: barra inferior flotante con las mismas secciones y «Más»; la acción «+ Comida» flota sobre la barra en el inicio.
- Mismo orden y nombres que hoy; la sección actual se marca con `aria-current` y con un cambio de forma (fondo elevado), no solo de color.
- Sin menú durante `/bienvenida` (FR-011).

### Inicio

Mosaico de bloques: semana (fila de siete días) arriba; debajo calorías (bloque ancho), entrenamiento, peso/sueño/pasos, suplementos reservado para la spec 022. Los datos, los hooks y los textos de significado no cambian; solo la composición. En celular los bloques se apilan.

### Resto de pantallas

Se aplican las clases comunes con un recorrido por feature, sin cambiar lógica:

1. Auth y primer ingreso (carcasa sin menú).
2. Comidas y alimentos.
3. Ejercicios.
4. Entrenamiento (solo piezas comunes; el rediseño completo es la spec 018).
5. Actividad, medidas, objetivo y plan, perfil.

## Estructura de archivos

```text
app/src/index.css                      # tokens, clases del sistema, tipografía
app/src/components/                    # AppShell, NavIcon, Card, PageHeader, StatusTag, Meter, Field, estados
app/src/routes/DesignSystemPage.tsx    # página de referencia /sistema
app/src/routes/HomePage.tsx            # composición del inicio
app/src/features/**                    # pantallas con clases del sistema (sin cambiar lógica)
app/tests/component/DesignSystem.test.tsx, Contrast.test.ts, Meter.test.tsx
app/tests/e2e/a11y-system.spec.ts
app/index.html, app/public/manifest*   # color de tema
```

## Verificación

- Lint, formato, typecheck y la suite completa de Vitest sin cambios de comportamiento.
- Playwright una parte por vez (accesibilidad con axe, 375 px y 200 % de zoom, teclado) sobre las pantallas principales y la página de referencia.
- Búsqueda de estilos sueltos (colores en hexadecimal y tamaños en píxeles fuera de `index.css`) sin resultados en las pantallas.
- Recorrido manual de escritorio y celular con el inventario de acciones por pantalla.
