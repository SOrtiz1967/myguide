# Dirección visual para un inicio denso y legible (tira de 7 días + detalle de hoy) en una PWA de fitness/nutrición

Notas de investigación. Convención: "Cited Findings" lleva solo hechos con fuente enlazada. Todo lo que es mi propio cálculo o criterio de diseño va en "Inferences" y está marcado: **[calc]** = calculado localmente (fórmula WCAG 2.x de luminancia relativa; simulación de daltonismo con matrices de Machado, severidad 1.0; distancia CIE76 dE), **[font-check]** = inspeccionado con fontTools sobre los TTF de `google/fonts` (rama main) y los woff2 de Fontsource vía jsDelivr, **[juicio]** = criterio de diseño sin fuente.

Contexto del proyecto leído (`app/src/index.css`): tokens `@theme` con `--color-bg/surface/ink/muted/line/accent/danger/success`, acento azul `#0b6e99` (claro) / `#5cb8e6` (oscuro), fuente `system-ui`, `prefers-reduced-motion` ya respetado, botones `min-height: 2.75rem` (44px). Las recomendaciones de abajo se escribieron para encajar con eso (mismo acento, sin sombras, bordes finos).

---

## 1. ¿Cómo son los mejores dashboards densos de fitness/datos y por qué funcionan?

### Takeaway
Los dashboards que funcionan separan la información en capas (un número/resumen primero, tendencia después, detalle exacto al final), usan color con significado fijo y no decorativo, y prefieren marcas lineales y compactas (barras, bullet graphs) sobre medidores radiales. Para la tira semanal, el patrón de referencia es el *bullet graph* de Few: una medida, una referencia y rangos cualitativos en poco espacio.

### Cited Findings
- Stephen Few creó el bullet graph para sustituir medidores y gauges de dashboard; su diseño "lineal y sin adornos" da "una presentación rica de datos en poco espacio" y "soporta una lectura más eficiente que los medidores radiales" — [Few, Bullet Graph Design Specification (PDF, rev. 2013)](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Componentes del bullet graph: etiqueta, escala cuantitativa lineal, medida principal, 1–2 medidas comparativas (opcionales) y 2–5 rangos cualitativos; la medida principal es una barra de grosor ≈ 1/3 del contenedor; la comparativa es una línea corta perpendicular; los rangos se limitan a máximo 5 e idealmente 3 — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Los rangos no se codifican con tonos distintos (pueden no distinguirse con daltonismo) sino con intensidades de un solo tono; Few da 3 rangos = 40 %, 25 %, 10 % de negro — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Si la escala no empieza en cero, la medida principal debe codificarse como símbolo (punto o X) en vez de barra — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Few prevé el caso "mejor cuando es bajo" invirtiendo la secuencia de rellenos, de modo que la distinción sea visible en una serie de bullets — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Whoop (según un desglose de agencia, no inspección directa): tres capas — resumen con números y sin gráficos, vistas de tendencia de "una pregunta por pantalla", y gráficos profundos (HRV, FC en reposo); sistema de color semántico de tres colores ("cada tono tiene significado"), fondo casi negro, tipografía grande para la métrica principal y pequeña para lo secundario. Las cifras concretas (p. ej. umbrales 67 %/33 %, "72 pt") no tienen fuente — [925Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- Oura (caso de estudio de la agencia que lo rediseñó): tres niveles de detalle — arriba "anillos, barras y señales de color simples" para lectura rápida, nivel medio con métricas enfocadas y patrones a corto plazo, y nivel profundo con vistas exploratorias precisas; "sistema de color semántico unificado", "tipografía refinada", visualizaciones reconstruidas como marco escalable — [Instrument, Oura](https://www.instrument.com/work/oura-app)
- Oura rediseñó la app en octubre de 2025 (tres pestañas: Today, Vitals, My Health; ventana de 12 meses); la recepción es mixta y se critica que nada es personalizable — [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/); [Digital Trends vía búsqueda](https://digitaltrends.com/?p=3738486)
- Reseña de la pantalla de inicio de Whoop (2023): muestra más datos por pantalla pero a usuarios nuevos "puede resultarles abrumador" — [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/)
- MacroFactor: la vista de "Nutrición y objetivos" alterna día/semana; tocar un día muestra ese día y deseleccionar muestra el resumen semanal; los gráficos tienen vistas minimizada/completa con rango elegible; el tema es oscuro y sobrio; hilos de usuarios muestran confusión con las leyendas de expenditure/trend — [MacroFactor](https://macrofactorapp.com/?p=2654); [ScreensDesign](https://screensdesign.com/showcase/macrofactor-macro-tracker); [Reddit r/MacroFactor](https://cal1.lr.ggtyler.dev/r/MacroFactor/comments/1grns7r/expenditure_and_weight_trend)
- Linear: rediseño con espacio de color LCH ("perceptualmente uniforme") que reduce 98 variables por tema a 3 (base, acento, contraste); Inter Display solo en títulos; el cromo con poco color; exploraciones iniciales solo con opacidades de blanco/negro para fijar jerarquía antes de añadir color — [Linear, How we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Stripe: paleta en CIELAB con curva de luminosidad común para todos los tonos; "dos colores separados al menos 5 niveles garantizan contraste suficiente para texto pequeño; 4 niveles para iconos y texto grande" — [Stripe, Accessible color systems](https://stripe.com/blog/accessible-color-systems)
- Estilo Bloomberg Terminal: Bloomberg gestiona la complejidad ocultándola y cuida el daltonismo en el diseño de color; las descripciones de paleta negra/blanca/naranja, numerales tabulares y verde/rojo son de terceros y reconstruidas, no documentación oficial — [Bloomberg](https://www.bloomberg.com/company/?p=28086); [Rosenfeld Media](https://rosenfeldmedia.com/advancing-research-2022/sponsors/bloomberg/); [webdesignhot (tercero)](https://www.webdesignhot.com/design.md/bloomberg/)
- Strong vs Hevy: Strong se percibe como más rápido y denso para el usuario experto (valores previos precargados, temporizador automático), Hevy más amable para novatos; son reseñas con afiliados y un blog escrito con IA, no análisis de UI — [RepReturn](https://repreturn.com/strong-app-vs-hevy/); [Setgraph](https://setgraph.app/ai-blog/hevy-vs-strong)

### Inferences
- **[juicio]** Rasgos comunes transferibles: (1) un solo número protagonista por bloque con unidad pequeña a su lado; (2) etiquetas en mayúsculas pequeñas o en gris secundario, nunca competir con el número; (3) separación por filetes (hairlines) y alineación, no por tarjetas con sombra; (4) 3–4 colores semánticos con significado constante; (5) todo el detalle exacto una pulsación más allá.
- **[juicio]** Para este proyecto, el nivel 1 (tira de 7 días + hoy) debe leerse sin abrir nada; el nivel 2 es el detalle de un día (se abre al tocar una columna de la tira); el nivel 3 (tendencia mensual, macros por comida) vive en otras pantallas. Es la misma jerarquía de 3 capas de Whoop/Oura.
- **[juicio]** La adaptación del bullet graph a "objetivo con tolerancia" invierte la lógica de Few: aquí la banda *es* el rango deseado (no "bueno/malo"), y fuera de ella hay dos estados (por debajo/por encima). Conviene usar una sola banda con tinte claro más dos zonas exteriores sin relleno, en vez de tres rangos de calidad. Esto además encaja con el lenguaje no coercitivo que exige la skill `nutrition-domain-rules` del repo.
- **[juicio]** Lo que mejor "se roba" de MacroFactor: tocar un día = enfocar ese día; deseleccionar = resumen semanal. Es progresiva divulgación sin cambiar de pantalla.

### Gaps
- No encontré análisis fiables con medidas concretas (tamaños, escalas, espaciado) de MacroFactor, Garmin Connect, Strong/Hevy ni Apple Health; solo reseñas descriptivas. No pude ver capturas (el análisis es textual). Mobbin/Page Flows requieren sesión; no los pude abrir.
- Los desgloses de Whoop son de una agencia, no de Whoop; cifras sin fuente.
- La página de Apple HIG "Charting data" devolvió contenido vacío al extraerla; no se citan sus recomendaciones. Conviene que el diseñador la lea directamente: https://developer.apple.com/design/human-interface-guidelines/charting-data

---

## 2. Tipografía para numerales y datos densos (tabulares, diacríticos en español, licencia libre, evitar Inter)

### Takeaway
Hay varias familias OFL con cifras tabulares y buen soporte latino que se alejan del "Inter en todas partes". Recomendación principal: **Schibsted Grotesk** (variable, 47 KB latin, `tnum` + `zero`); alternativas por carácter: **Archivo** (eje de ancho 62–125 para numerales condensados), **Familjen Grotesk** (la más ligera, 19 KB, cifras tabulares por defecto) y **IBM Plex Sans Condensed** (ambiente "terminal"). Siempre activar `font-variant-numeric: tabular-nums lining-nums` y comprobar en navegador que el subconjunto de Fontsource conserva las features.

### Cited Findings
- Las cifras tabulares usan ancho fijo para que las columnas alineen; para dashboards se citan Inter, Roboto, IBM Plex Sans (y Source Sans 3, Lato) como gratuitas; Inter ofrece cero con barra — [Made Good Designs](https://madegooddesigns.com/best-fonts-for-dashboards/)
- Source Sans 3 se señala como una de las de conjunto de numerales más completo (tabular/proporcional, lining/oldstyle) — [UX Planet, number fonts (resumen de búsqueda; la página devolvió 403 al abrirla, no verificado)](https://uxplanet.org/everything-you-need-to-know-about-number-fonts-e76f4d1913ad)
- Fontsource: `ibm-plex-sans-condensed` (OFL-1.1, subsets latin y latin-ext, pesos 100–700, no variable) — [API Fontsource](https://api.fontsource.org/v1/fonts/ibm-plex-sans-condensed)
- Fontsource, ejes variables y licencia OFL-1.1 de: Archivo (wdth 62–125, wght 100–900), Schibsted Grotesk (wght 400–900), Familjen Grotesk (wght 400–700), Bricolage Grotesque (opsz 12–96, wdth 75–100, wght 200–800), Sofia Sans Condensed (wght 1–1000), Geist (wght 100–900), Instrument Sans (wdth 75–100, wght 400–700), Space Grotesk (wght 300–700); todos con subsets `latin` y `latin-ext` — [Fontsource API: archivo](https://api.fontsource.org/v1/fonts/archivo), [schibsted-grotesk](https://api.fontsource.org/v1/fonts/schibsted-grotesk), [familjen-grotesk](https://api.fontsource.org/v1/fonts/familjen-grotesk), [bricolage-grotesque](https://api.fontsource.org/v1/fonts/bricolage-grotesque), [sofia-sans-condensed](https://api.fontsource.org/v1/fonts/sofia-sans-condensed)
- Tamaños de los woff2 variables (subset latin) servidos por `@fontsource-variable`: Familjen Grotesk 18.9 KB, Geist 29.4 KB, Sofia Sans Condensed 41.2 KB, Schibsted Grotesk 46.8 KB, Archivo (archivo-latin-wdth-normal) 90.1 KB — [jsDelivr @fontsource-variable/familjen-grotesk](https://cdn.jsdelivr.net/npm/@fontsource-variable/familjen-grotesk/files/familjen-grotesk-latin-wght-normal.woff2) (y rutas análogas de cada familia)

### Inferences
**[font-check]** Resultado de inspeccionar los TTF completos de `google/fonts`. "tnum" = la feature OpenType existe y mapea los 10 dígitos a un único ancho. "Tabular por defecto" = los dígitos 0–9 ya tienen el mismo ancho sin activar nada. "Faltan" = glifos de `áéíóúüñÁÉÍÓÚÜÑ¿¡ºª€·−×≈±→↑↓…–—“”%` ausentes del cmap. (Todas incluyen las vocales acentuadas, ñ, ¿, ¡.)

| Familia | tnum | zero (cero con barra) | Tabular por defecto | Faltan | Notas |
|---|---|---|---|---|---|
| Schibsted Grotesk | sí | sí | no | nada | editorial, 400–900 |
| Archivo (wdth+wght) | sí | sí | no | nada | eje de ancho: numerales condensados |
| Familjen Grotesk | sí | sí | **sí** | nada | rasgos peculiares, 400–700, muy ligera |
| Bricolage Grotesque | sí | no | no | nada | muy expresiva; eje opsz; cuidado con exceso de carácter |
| Sofia Sans Condensed | sí | no | no | nada | condensada, buena para cifras grandes |
| Space Grotesk | sí | sí | no | nada | reconocible/sobreusada en "tech" |
| Geist | sí | no | no | nada | muy parecida a la estética Vercel/Inter |
| Instrument Sans | sí | no | no | ≈ ± | |
| Figtree | sí | no | no | ≈ | |
| Radio Canada | sí | no | sí | → ↑ ↓ | |
| IBM Plex Sans / Condensed | no hay feature, pero **ya tabular** | sí | **sí** | nada | Plex Sans variable existe con wdth 75–100; Condensed es estática |
| Source Sans 3 | ya tabular | sí | sí | nada | |
| Manrope, Onest, Overpass, Public Sans, Sora | sí | varía | no | flechas/≈ en algunas | |
| Mono: JetBrains Mono, IBM Plex Mono, Red Hat Mono, Spline Sans Mono, DM Mono, Geist Mono, Fragment Mono | n/a (monoespaciada) | la mayoría sí | sí | Red Hat Mono: ≈ →; Spline/DM Mono: flechas | |

Notas: la ausencia de flechas (→↑↓) y `≈` en varias es irrelevante si se dibujan con SVG (que es lo recomendable para ▲▼ de estado). Hay que comprobar que el subset `latin` de Fontsource conserva `−` (U+2212), `€`, `·`, `×` y las features `tnum`/`zero`; **no lo verifiqué** (ver Gaps).

**Recomendaciones concretas [juicio]:**
1. **Principal — Schibsted Grotesk** (400/500/600/700, variable) para UI y números. Aspecto editorial/periodístico, claramente distinto de Inter, con `tnum` y `zero`. CSS: `font-feature-settings: "tnum" 1, "zero" 1` (o `font-variant-numeric: tabular-nums slashed-zero`).
2. **Alternativa "instrumento" — Archivo** una sola familia: UI en `font-stretch: 100%`, cifras héroe y de la tira en `font-stretch: 75–85%` y peso 600–700. Ventaja: números grandes sin ocupar ancho; coste: 90 KB (verifica si necesitas ambos ejes; el archivo "wdth" de Fontsource incluye wght según su nombre de variable `full`/`wdth`: confirmar).
3. **Alternativa mínima — Familjen Grotesk** 19 KB, tabulares por defecto: menor coste de PWA y carácter propio. Solo 400–700.
4. **Alternativa "terminal/Bloomberg" — IBM Plex Sans Condensed + IBM Plex Mono** para etiquetas/valores; estáticas (peso por archivo): cargar solo 400 y 600.
5. Emparejamiento: no hace falta segunda familia. Si se quiere contraste, usar una mono (IBM Plex Mono o JetBrains Mono) **solo** para pequeñas etiquetas técnicas (p. ej. "kcal", rangos "1.800–2.200"), no para todos los números: el mezclar mono + proporcional rompe el ritmo vertical.
6. **Escala móvil [juicio, base 360–430 px]** (tamaño/interlineado en px):
   - Número héroe de hoy: 44/44 (peso 600, tabular, tracking −0.01em); unidad "kcal" 15/20 en `--muted`, alineada a la línea base.
   - Cifra secundaria (macros, restantes): 20/24.
   - Cuerpo / filas de detalle: 15/22 (no bajar de 15 el texto que se lee en frase).
   - Número de día en la tira: 15/18 tabular, peso 600.
   - Letra del día y microetiquetas: 11/14 con mayúsculas y +0.04em de tracking (no usar <11 px; 12 si no sobrecarga).
   - Interlineado de numerales grandes 1.0–1.1; de texto 1.4–1.5.
7. Español: separador de miles con punto en `es-ES` (`Intl.NumberFormat('es-ES')` omite el punto en 4 cifras: "1800" — usar `useGrouping: 'always'` si se quiere "1.800"); coma decimal; unidad con espacio fino/no separable ("1.800 kcal"); signos con U+2212 "−" (no guion) para déficits. Días de la semana abreviados en una letra: L M X J V S D (la X para miércoles es la convención española).
8. Rendimiento: `font-display: swap`, precargar solo el woff2 latin del peso principal, `unicode-range` latin (Fontsource ya lo trae), definir una fuente fallback con `size-adjust` para evitar salto de layout; el CSS actual usa `system-ui` para que la carcasa cargue sin red — mantenerlo como fallback.

### Gaps
- No verifiqué visualmente cómo se ven los numerales de cada familia (no pude renderizar con fuentes incrustadas); el juicio estético ("editorial", "peculiar") es mío y conviene previsualizar 3 candidatos en el propio inicio.
- No comprobé que los subsets latin de Fontsource conserven `tnum`/`zero` ni U+2212/€; comprobarlo con la consola (`document.fonts`, o Wakamai Fondue) antes de fijar la elección.
- No verifiqué qué archivo de Fontsource contiene ambos ejes de Archivo (wdth+wght) ni su tamaño; solo medí `archivo-latin-wdth-normal.woff2` (90 KB).
- No encontré una fuente primaria sobre el soporte de diacríticos españoles por familia más allá de mi comprobación del cmap.

---

## 3. Sistemas de color accesibles (AA claro/oscuro, sin rojo/verde, apto para daltonismo, estados neutros)

### Takeaway
Codificar los estados con **forma + posición + valor numérico** y usar el color solo como refuerzo: por debajo / en rango / por encima / sin datos se distinguen por posición dentro de la banda, glifo (▼ ▲, punto, guion discontinuo) y texto con signo ("−320 kcal"). Hay que reducir el color a dos familias (azul del acento = "en rango", ámbar-naranja = "fuera de rango"), porque ámbar y bermellón son prácticamente indistinguibles con deuteranopía.

### Cited Findings
- WCAG 1.4.11 (AA): partes de gráficos "necesarias para entender el contenido" requieren 3:1 contra los colores adyacentes; la excepción: si la información la transmite también texto (etiquetas y valores), esos gráficos no son imprescindibles — [W3C, Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
- Líneas de gráficos de líneas: 3:1 contra el fondo; no hace falta 3:1 entre líneas si apenas se solapan; en un pie chart con etiquetas y valores visibles pasa — [W3C, Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
- 1.4.1 "Uso del color" (nivel A) es independiente: la información no puede transmitirse solo por color; un cambio solo de tono para un valor falla 1.4.1 — [W3C, Understanding 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast); [Tabnav](https://tabnav.com/academy/wcag/success-criterion-1.4.11)
- Los umbrales de 3:1 son valores límite: no se redondean (2,999:1 falla) — [W3C](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
- Datawrapper: la mitad de las opciones daltónico-seguras no tienen que ver con el color (etiquetas, símbolos, formas, patrones, anchos y guiones de línea); recomienda etiquetas directas y que los colores difieran en luminosidad; las combinaciones problemáticas son tonos de brillo similar (rojo-verde, naranja-verde, amarillo-rosa, azul-verde) — [Datawrapper](https://www.datawrapper.de/blog/colorblindness-part2)
- Paleta Okabe-Ito (8 colores diseñados para ser distinguibles en las formas principales de daltonismo): `#000000 #E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7` — [R grDevices / factoextra](https://rdrr.io/cran/factoextra/man/factoextra_palette.html)
- Few: rangos de un mismo tono por intensidad, no tonos distintos, por daltonismo — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Stripe y Linear generan paletas en espacios perceptuales (Lab/LCH) para que el contraste sea predecible por diferencia de pasos — [Stripe](https://stripe.com/blog/accessible-color-systems); [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)

### Inferences
**Paleta propuesta, coherente con los tokens actuales del repo (acento azul)** — **[calc]** razones de contraste WCAG:

Claro (`bg #F4F6F8`, `surface #FFFFFF`):

| Token | Hex | Sobre bg | Sobre surface | Uso |
|---|---|---|---|---|
| ink | `#14212B` | 15.1 | 16.4 | números, títulos |
| muted | `#4A5B68` | 6.5 | 7.0 | etiquetas, secundario |
| faint | `#5F6F7B` | 4.8 | 5.2 | texto terciario (mínimo AA) |
| accent / "en rango" | `#0B6E99` | 5.2 | 5.7 | barra en rango, selección, foco |
| outside / "fuera de rango" | `#A8420A` | 5.6 | 6.1 | barra fuera de banda, ▲/▼ |
| band (tinte de banda objetivo) | `#D6E6EE` | — | 1.28 vs surface | fondo de la banda; barra accent sobre ella 4.43 |
| line (filete decorativo) | `#C5CFD7` | 1.46 | 1.58 | separadores (decorativos) |
| line-strong (ticks, bordes con significado) | `#8497A5` | 2.79 | 3.02 | límites de banda, bordes de componente (≥3:1 sobre surface) |

Oscuro (`bg #0F171D`, `surface #16222B`):

| Token | Hex | Sobre bg | Sobre surface |
|---|---|---|---|
| ink | `#E8EEF2` | 15.5 | 13.8 |
| muted | `#A3B3BF` | 8.4 | 7.5 |
| faint | `#8696A3` | 5.95 | 5.3 |
| accent / "en rango" | `#5CB8E6` | 8.15 | 7.3 |
| outside | `#F2A15F` | 8.65 | 7.7 |
| band | `#1C3646` | — | barra accent sobre band 5.68 |
| line-strong | `#5B6E7C` | 3.42 | 3.06 |

Texto sobre rellenos: blanco sobre `#0B6E99` = 5.67; `#06222F` sobre `#5CB8E6` = 7.40; blanco sobre `#A8420A` = 6.09; `#0F171D` sobre `#F2A15F` = 8.65. (Estos tokens `accent` y `accent-ink` ya existen en el repo y cumplen.)

**Hallazgo de la simulación de daltonismo [calc]:**
- Con el par anterior accent vs outside, dE (CIE76) tras simular deuteranopía/protanopía/tritanopía = 84/72/92 (claro) y 82/71/86 (oscuro): se distinguen bien por tono. Pero su **razón de luminosidad es solo 1.07 (claro) y 1.06 (oscuro)**, es decir, en escala de grises son casi idénticos. Por tanto no basta el color: la forma/posición es obligatoria (cumple 1.4.1 y mejora impresión en pantalla de baja calidad).
- En una primera prueba con una paleta de tres hues (azul `#0B5C8A`, ámbar `#8A5A00`, bermellón `#B3380A`) el par ámbar/bermellón tuvo dE = 3 (deuteranopía) y 7 (protanopía): prácticamente el mismo color. **Conclusión: no distinguir "por debajo" de "por encima" con dos hues cálidos.** Diferenciarlos por glifo y por posición respecto a la banda, no por color.

**Semántica de estados (neutra, sin juicio moral) [juicio]:**

| Estado | Texto (es) | Marca en la barra | Glifo | Color | Texto sin color |
|---|---|---|---|---|---|
| En rango | "En rango" | barra llena termina dentro de la banda | punto lleno ● | accent | "2.050 kcal · en rango" |
| Por debajo | "Por debajo" | barra termina antes de la banda | ▼ (triángulo hacia abajo) | outside | "−320 kcal respecto al mínimo" |
| Por encima | "Por encima" | barra sobrepasa la banda (segmento extra con patrón rayado diagonal) | ▲ | outside | "+180 kcal sobre el máximo" |
| Sin datos | "Sin registro" | solo la banda, sin barra, borde discontinuo | ○ vacío / guion | faint | "Sin registro" |
| Hoy, en curso | "En curso" | barra abierta, sin veredicto hasta que acabe el día | punto con anillo | accent | "1.640 de 2.000 kcal" |

Importante: "por debajo" no es "mal" ni "por encima" es "fallo" (el proyecto exige lenguaje no coercitivo); evitar rojo, evitar iconos de error/✓ de aprobado. Un día incompleto (hoy) no debe leerse como "por debajo".

**Tokens CSS (Tailwind 4 `@theme` + modo oscuro) [juicio]:** añadir a los existentes `--color-in-range`, `--color-out-of-range`, `--color-band`, `--color-line-strong`, `--color-faint`, reasignar en `@media (prefers-color-scheme: dark)` y en `[data-theme="dark"]` si hay selector manual. Desaconsejo reutilizar `--color-danger/success` para estados de calorías: son rojo/verde.

### Gaps
- No pude validar con axe real: confirmar con `@axe-core/playwright` o similar. La razón de contraste de `line`/`band` no es un requisito si el valor y la etiqueta están en texto (excepción del Understanding 1.4.11), pero las marcas que definen la banda sí deben tener 3:1 si son la única indicación (usar `line-strong`).
- Mi simulación de daltonismo usa matrices de Machado con una aproximación de dE (CIE76); no es una validación con herramienta estándar (Color Oracle, Viz Palette). Repetir allí.
- No encontré guías oficiales de Material/Apple con números sobre color en gráficos que pudiera citar (la página de Apple devolvió vacío).

---

## 4. Patrones de layout para la tira de 7 días en 360–430 px

### Takeaway
Siete columnas iguales de ≥44 px sin huecos (separadas por filetes) caben desde 360 px: con 8 px de margen lateral cada columna mide ≈ 49 px; con 16 px, ≈ 46.9 px. Cada columna es un único `<button>` de 44–48 × ~100 px con letra del día, número, mini-bullet vertical y marcador de entreno. Tocar abre/enfoca el detalle del día sin abandonar la pantalla.

### Cited Findings
- WCAG 2.1 SC 2.5.5 (AAA): objetivos de puntero de al menos 44×44 px CSS, con excepciones (equivalente, en línea, controlado por el agente, esencial); recomienda mayor tamaño para controles frecuentes, difíciles de deshacer o cerca del borde — [W3C, Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- MacroFactor: tocar un día enfoca ese día, deseleccionarlo vuelve al resumen semanal — [MacroFactor](https://macrofactorapp.com/?p=2654)
- Los dashboards de Whoop/Oura organizan en niveles de detalle (resumen → tendencia → profundo) — [925Studios](https://www.925studios.co/blog/whoop-design-breakdown); [Instrument](https://www.instrument.com/work/oura-app)

### Inferences
**Matemática de ancho [calc]:** 360 px − 2×16 = 328 → 46.86 px por columna; 375 − 32 = 343 → 49.0; 390 → 51.1; 430 → 56.9. Con huecos de 4 px (6 huecos = 24 px) a 360: (328 − 24)/7 = 43.4 px (<44): **no usar huecos en 360**; separar con filetes de 1 px (que ocupan el borde de la columna) o bajar el margen a 12 px (336/7 = 48).

**Alto de la columna [juicio]:** ≈ 100–108 px: letra del día 11/14 (+4) · número 15/18 (+4) · bullet vertical 44 px · marcador de entreno 16–20 px · padding 8.

**Boceto de la tira (≈ 360 px de ancho, columnas de 46–47 px):**

```
 SEMANA 20–26 OCT                     media 2.140 kcal ▸
 ┌────┬────┬────┬────┬────┬────┬────┐
 │ L  │ M  │ X  │ J  │ V  │ S  │ D  │   11/14, mayúsculas, muted
 │ 20 │ 21 │[22]│ 23 │ 24 │ 25 │ 26 │   15/18 tabular; hoy = recuadro 2px ink
 │ ▒▒ │ ▒▒ │ ▒▒ │ ▒▒ │ ▒▒ │ ▒▒ │ ▒▒ │
 │ ─┬─│ ─┬─│ ─┬─│ ─┬─│ ─┬─│ ─┬─│ ─┬─│   límite superior de banda (tick line-strong)
 │ ▒█▒│ ▒█▒│ ▒░▒│ ▒█▒│ ▒▲▒│    │ ▒█▒│   █ = en rango, ▲ = por encima, ░ = en curso
 │ ─┴─│ ─┴─│ ─┴─│ ─┴─│ ─┴─│ ·· │ ─┴─│   límite inferior; ·· = sin registro (discontinua)
 │ ■  │ ─  │ ■  │ □  │ ■  │ ─  │ □  │   ■ hecho  □ planificado  ─ descanso
 └────┴────┴────┴────┴────┴────┴────┘
   Leyenda (1 línea, 11px):  ● en rango  ▼ por debajo  ▲ por encima  ○ sin registro   ■ entreno hecho  □ planificado
```

El *bullet vertical* de cada día: pista de 44 px de alto y ~14 px de ancho centrada; banda objetivo con relleno `band`; dos ticks `line-strong` en los límites del rango (objetivo ± tolerancia); barra de ingesta de ancho ~8 px desde abajo; si pasa el límite superior se añade un segmento rayado y un ▲ de 8 px sobre la barra. Para valores muy por encima de la escala, cortar la pista al 130 % del objetivo con una marca de truncamiento. Es el equivalente vertical de las proporciones de Few (barra ≈ 1/3 del contenedor).

**Vertical vs horizontal [juicio]:** columnas verticales (la tira) son preferibles a filas de 7 renglones porque el eje del tiempo queda a lo ancho (lectura de patrón semanal en un vistazo) y la altura de pantalla se reserva para "hoy". Una vista alternativa en filas (un día por renglón con barra horizontal de ancho completo, ≈ 48 px de alto cada una, 7 × 48 = 336 px) es mejor si se quiere mostrar el número de kcal por día; decidir con una prueba de 5 usuarios.

**Boceto de "hoy" (detalle, debajo de la tira):**

```
 HOY · MIÉ 22 OCT                                    ← 11px muted, mayúsculas
 1.640 kcal   de 2.000                                ← 44/44 + 15/20 muted
 Quedan 360 · rango 1.800–2.200
 ├───────[▓▓▓▓▓▓▓▓▓▓▓▓▓░░░|░░░░░░░░░░░]──┤            ← bullet horizontal 14px alto, ancho completo
 0         1.800        2.200       2.600           ← ticks 11px, tabular
 ───────────────────────────────────────────────────
 Proteína    112 g     de 140      ▕████▍   ▏        ← filas de ledger, 44px de alto cada una
 Carbohidr.  190 g     de 220      ▕█████  ▏
 Grasa        48 g     de  70      ▕███▍    ▏
 ───────────────────────────────────────────────────
 Entreno   Pierna A · 52 min                ■ hecho   ← marcador + texto
 ───────────────────────────────────────────────────
 [ + Registrar comida ]   [ Iniciar entreno ]           ← min-height 44, ancho 50 % cada uno
```

**Divulgación progresiva [juicio]:** (1) tira + hoy sin pulsar nada; (2) tocar un día → la sección "hoy" cambia a ese día (título "MAR 21 OCT") y la columna pasa a `aria-pressed=true`; (3) botón "Ver día" / chevron lleva a la pantalla completa del día. Evitar modales y hojas inferiores sobre la tira; mantener el foco en el botón tocado.

**Accesibilidad de cada columna [juicio]:** `<button aria-pressed>` con `aria-label` completo: "Miércoles 22 de octubre, 1.640 de 2.000 kilocalorías, por debajo del rango, entreno hecho". Texto visible en la columna con `aria-hidden` en glifos decorativos. Foco visible 3 px accent (ya definido en el repo). Contenedor `role="group"` con `aria-label="Semana del 20 al 26 de octubre"`. No usar `role="tablist"` salvo que el comportamiento sea de pestañas reales.

### Gaps
- La exigencia AA de WCAG 2.2 SC 2.5.8 (24×24 px) la conozco por memoria; la página consultada solo cubría 2.5.5. Tampoco verifiqué qué reglas de axe-core (p. ej. `target-size`) están activas según la versión del proyecto.
- No encontré mediciones de tamaños de la tira semanal en MacroFactor, Garmin Connect ni Apple Health. Las dimensiones de arriba son propuestas derivadas, no medidas de apps reales.

---

## 5. Marcas y gráficos: anillo vs barra vs bullet; multiplicadores pequeños; sparklines; etiquetas y unidades

### Takeaway
Para "objetivo con tolerancia", el bullet (barra + banda + ticks) es la marca adecuada: muestra a la vez cuánto, dónde está el rango y si queda dentro. Los anillos sirven para un único resumen de "hoy" pero no expresan una tolerancia con claridad y gastan espacio en una tira de 7. Las pequeñas múltiples (misma escala en los 7 días) hacen comparable la semana.

### Cited Findings
- El bullet graph se creó para reemplazar medidores y gauges por ser más compacto y eficiente de leer que los radiales — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Few: rangos 2–5 (ideal 3), tintes de un tono, sin bordes; medida principal 1/3 del grosor del contenedor; comparativa como línea corta perpendicular; marcas de la escala en gris claro con trazo fino; etiquetas en negro legible — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Si la escala no arranca en cero, usar punto o X para la medida principal — [Few, spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- Oura emplea anillos, barras y señales de color en el nivel de lectura rápida — [Instrument](https://www.instrument.com/work/oura-app)
- WCAG: si los valores y etiquetas están visibles como texto, las formas del gráfico no necesitan cumplir 3:1 como único portador de información — [W3C](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast)
- Datawrapper recomienda etiquetas directas, símbolos, patrones y anchos/guiones de línea como alternativas al color — [Datawrapper](https://www.datawrapper.de/blog/colorblindness-part2)

### Inferences
- **[juicio, conocimiento general sin fuente verificada aquí]** La literatura de percepción gráfica (Cleveland & McGill) sitúa la longitud alineada por encima del ángulo/área en precisión de lectura, y Few/Tufte critican medidores radiales por la misma razón. No recuperé esas fuentes en esta sesión.
- **Comparativa de marcas para la tira:**

| Marca | Pros | Contras en 47 px de ancho | Veredicto |
|---|---|---|---|
| Anillo (donut) | familiar (Oura/Apple Activity) | radio ≈ 18 px; trazo fino; no muestra tolerancia ni excedente claro; dos valores (kcal y entreno) no caben | Solo para "hoy" si se quiere continuidad con la marca del sector |
| Barra vertical simple | fácil de leer | sin referencia de rango; el exceso es ambiguo | Insuficiente sola |
| **Bullet vertical (barra + banda + 2 ticks)** | muestra objetivo con tolerancia; comparable en 7 días | requiere leyenda una vez | **Recomendado** |
| Punto en rango ("dot-in-range") | máxima densidad (≈ 8 px) | pierde magnitud | Para vista compacta mensual (calendario) |
| Línea de tendencia/sparkline | muestra patrón | solo sirve con ≥7 puntos y sin tolerancia | Complemento en la fila de resumen semanal |

- **Pequeñas múltiples [juicio]:** los 7 mini-bullets comparten escala (0–130 % del objetivo), banda a la misma altura en todos los días: los límites de banda forman una "autopista" horizontal que hace visible el patrón sin leer números. Máximo 3 estados por día en la capa 1; los macros van en el detalle.
- **Sparkline (Tufte) [juicio]:** usar para media móvil de peso/ingesta en la fila "media 2.140 kcal ▸" (60×16 px, trazo 1.5 px `muted`, punto final en `ink`); sin ejes, con el último valor como texto adjunto.
- **Etiquetado y unidades [juicio]:** escribir la unidad una vez por bloque ("kcal" junto al héroe; en filas ledger, la unidad a la derecha en `muted`); números alineados a la derecha en columnas con `tabular-nums`; etiquetar la banda en el detalle con valores ("1.800–2.200"), no en cada día; no usar porcentajes en la tira si el usuario piensa en kcal; signo explícito (+/−) para diferencias; "–" sin dato nunca "0". Texto alternativo en cada marca (ver §4).
- **Patrón para el exceso (accesible sin color) [juicio]:** segmento extra con hatch diagonal 45° de 1.5 px sobre la banda `outside` + glifo ▲; para el déficit, la barra se queda corta y la banda queda visible por encima + glifo ▼. Con esto un impreso en blanco y negro sigue siendo legible.
- **Estados de entreno [juicio]:** ■ hecho (relleno ink), □ planificado (contorno 1.5 px ink), ─ descanso (guion muted), ⊘ omitido opcional. Formas distintas, mismo color casi: no depende del tono.

### Gaps
- No tengo fuente verificada para percepción gráfica (Cleveland & McGill, Tufte) ni para guías de Material/Apple sobre gráficos de actividad; lo anterior es criterio, no cita.
- No encontré datos de usabilidad (tests) comparando anillos vs bullets para objetivos nutricionales.

---

## 6. Movimiento, interacción y rendimiento en una PWA

### Takeaway
Animar poco y solo con `transform`/`opacity`; que cada animación comunique un cambio de estado (selección de día, valor que se actualiza) y desaparezca con `prefers-reduced-motion`. En una PWA, el coste real está en fuentes, SVG y re-renders, no en el CSS.

### Cited Findings
- Whoop usa animaciones suaves en la transición entre niveles "para preservar el contexto espacial" (sin tiempos ni easing documentados) — [925Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- Linear subraya que la alineación y la reducción de ruido visual son lo que el usuario "siente" tras unos minutos, y que el rediseño debe evolucionar y no desmontar el producto — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- El repo ya aplica `prefers-reduced-motion: reduce` (duraciones de 0.01 ms) — `app/src/index.css` (archivo local del proyecto)

### Inferences
- **[juicio]** Presupuesto de movimiento: 120–180 ms para selección de día (cambio de borde/relleno, cross-fade del bloque "hoy"), 0 ms para cambios de datos; sin animar el llenado de las barras al cargar (o, si se hace, una sola vez en 240 ms con `transform: scaleY`, con origen en la base; omitido con reduced motion). Evitar contadores que "cuentan" números: dificultan lectura y los lectores de pantalla.
- **[juicio]** SVG inline (no librería de gráficos) para 7 mini-bullets: ≈ 30 nodos; sin canvas. Un componente `<DayBullet>` puro con `memo` y props numéricas; `aria-hidden` en el SVG y la información en el `aria-label` del botón.
- **[juicio]** Carga: 1 woff2 variable (≤ 50 KB) con `font-display: swap`; sin `backdrop-filter`, sin sombras grandes, sin gradientes animados; `content-visibility: auto` en secciones fuera de pantalla; actualizar solo la columna cambiada al registrar una comida (optimistic update).
- **[juicio]** Interacción: respuesta al tacto inmediata (estado `:active` con cambio de fondo, sin ripple), feedback háptico opcional vía `navigator.vibrate` sólo en acciones de confirmación, `touch-action: manipulation` para eliminar el retardo de doble toque, `scroll-snap` no necesario (la tira cabe sin scroll). Alternativas sin gestos: nunca depender de swipe para cambiar de semana, ofrecer botones ‹ ›.
- **[juicio]** Modo oscuro: `color-scheme: light dark` (ya está) + el selector manual `[data-theme]` si la app lo ofrece; evitar #000 puro y blanco puro (halo): usar `bg #0F171D` e `ink #E8EEF2` de §3.

### Gaps
- No encontré fuentes con tiempos/curvas de animación de apps de fitness; los valores son recomendaciones propias.
- No medí rendimiento real (Lighthouse/INP) de ninguna implementación.

---

## 7. Antipatrones que hacen que una UI de fitness parezca plantilla, y alternativas creíbles

### Takeaway
Lo "plantilla" son: tarjetas redondeadas idénticas con sombra y degradado, neón sobre negro, anillos decorativos de colores sin dato exacto, iconografía genérica. Alternativas creíbles: estructura de libro de registro (filetes, columnas alineadas, números tabulares), una sola acentuación, fondo cálido-neutro o azul pizarra sobrio y densidad controlada.

### Cited Findings
- Linear exploró primero solo con opacidades de blanco/negro para establecer elevación y jerarquía antes de añadir color; limita deliberadamente el color del cromo — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Whoop: "no hay colores de acento arbitrarios; cada tono tiene significado" (según desglose de agencia) — [925Studios](https://www.925studios.co/blog/whoop-design-breakdown)
- Whoop/Oura reciben críticas por abrumar a nuevos usuarios y por falta de personalización, respectivamente — [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/); [Digital Trends](https://digitaltrends.com/?p=3738486)
- El comentario de la comunidad de Whoop sobre los dashboards que "parecen anticuados" muestra que la presión es hacia lo moderno, no hacia más decoración — [Comunidad Whoop](https://www.community.whoop.com/t/make-whoop-dashboard-futuristic-and-intuitive/14854) (solo el título de la hilera consultado; es opinión de un usuario)
- No encontré una fuente académica o de teardown sobre "estética plantilla de apps de fitness" como tal.

### Inferences
**[juicio]** Lista de antipatrones y sustitución:

| Antipatrón | Por qué falla | Alternativa creíble |
|---|---|---|
| Rejilla de tarjetas del mismo tamaño y radio 16–24 px con sombra | todo pesa igual; no hay jerarquía | Una "hoja" sobre el fondo; secciones separadas por filetes de 1 px; solo el bloque de "hoy" con superficie propia y radio 6–8 px |
| Degradados morado→azul / sombras de color | genérico, bajo contraste de texto | Tintes planos de un tono; texto siempre `ink` sobre fondos neutros |
| Neón sobre negro puro | fatiga, contraste excesivo, sin matices | Fondo azul pizarra `#0F171D`, acento `#5CB8E6` solo para datos/selección |
| Anillos grandes de colores como adorno | gastan espacio, valores ocultos | Número protagonista + bullet; anillo opcional y pequeño |
| Verde/rojo para "bien/mal" | falla con daltonismo; connota culpa | Azul = en rango; naranja ocre = fuera de rango + glifos ▲▼ + texto neutro |
| Todos los números en negrita y del mismo tamaño | sin jerarquía | Un número héroe (44 px) + cifras de 20 px + resto 15 px regular |
| Emojis/iconos 3D como decoración | infantil, impreciso | Glifos geométricos propios (■ □ ● ▲ ▼) de 8–16 px, trazo 1.5 px |
| Barras de progreso de 100 % lleno = "éxito" | gamificación coercitiva | Banda de rango; copia neutra ("En rango", "Por debajo") |
| Inter + 3 pesos + 6 tamaños azarosos | mismo aspecto que cualquier SaaS | Una familia con carácter (§2), escala fija de 6 pasos |

**Dirección propuesta con nombre [juicio]: "Libro de registro".** Superficie clara `#F4F6F8` o pizarra oscura `#0F171D`; texto en Schibsted Grotesk; 1 acento azul; alineación estricta en una rejilla de 4 px; títulos de sección en mayúsculas 11 px con filete debajo; "hoy" ocupa la mayor jerarquía tipográfica. Variación opcional "Instrumento" (Archivo condensada para cifras) si se quiere una estética más técnica.

### Gaps
- No hay fuente sólida sobre cuáles son los patrones "plantilla" más extendidos; la lista es mi observación y no un resultado de investigación.
- Mobbin/Page Flows/Behance/Dribbble no se pudieron consultar (acceso o contenido no recuperable con las herramientas disponibles).
