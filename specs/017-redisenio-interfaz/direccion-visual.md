# Dirección visual elegida: C «Bloques»

**Fecha de la decisión:** 2026-10-28. **Quién decide:** el autor (FR-001 y FR-002 de la spec).

## Qué se exploró

Se presentaron tres direcciones sobre dos pantallas (inicio en escritorio y, en celular, inicio y «Agregar comida»):

- **A, Instrumento:** denso, líneas finas, cifras en tipografía monoespaciada, menú lateral de texto.
- **B, Hoy primero:** tipografía grande, un solo foco por pantalla, menú superior en píldora y barra inferior flotante.
- **C, Bloques:** mosaico de bloques redondeados con un tono propio por tema (calorías, entrenamiento, peso) y una columna de íconos como menú en escritorio.

## Decisión

El autor eligió **C**: «me gustó más la C, me convence bastante». El motivo declarado es que le convence más que las otras dos; no pidió mezclar elementos de A o B.

## Qué queda fijado

- Estructura del inicio en bloques tonales, uno por tema, con el panel del día y la semana dentro del mismo mosaico.
- Menú en escritorio como columna de íconos con su nombre en texto; en celular, barra inferior.
- Los estados siguen diciéndose con texto más una forma (●, ▽, ◔, ■, □), nunca solo con color, y no se usa rojo ni verde como juicio sobre calorías, peso o rendimiento (Principio IV).
- Los botones «Marcar como completado» y «Hice otro entrenamiento» se muestran solo si hay una rutina asignada ese día; si no, la opción es «Cargar entrenamiento» (decisión del autor, spec 018).

## Qué falta definir en el plan

- Paleta final de los tonos de los bloques, verificada con contraste AA sobre el fondo oscuro.
- Tipografía y escala, espaciado y radios, como tokens del sistema de componentes.
- Cómo se ven en C las pantallas que no se maquetaron (medidas, objetivo y plan, perfil, primer ingreso, autenticación, estados vacío, de carga y de error).

Las maquetas de las tres direcciones quedaron en el lienzo de diseño compartido en la sesión de trabajo; la dirección C es la referencia visual de la spec.
