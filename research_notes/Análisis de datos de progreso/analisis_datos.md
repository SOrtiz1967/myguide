# Investigación: análisis de datos de alimentación, entrenamiento y progreso (nota 6, spec 010)

Fecha: 2026-11-01. Búsquedas web estándar más conocimiento del dominio. Las fuentes son en su mayoría secundarias (blogs, proveedores de apps); donde no hay fuente rigurosa se dice.

## 1. Calorías y macros registrados

Análisis honestos con lo que ya se guarda (comidas con calorías y macros, objetivo de la spec 004):

- **Promedio de los días con registro frente al objetivo**, por semana. Se promedia solo sobre los días que tienen comidas; un día sin registro es «sin dato», no cero (Principio V).
- **Días dentro del rango de ±10 % del objetivo**, como conteo («4 de 6 días con registro»), sin porcentaje de «adherencia» ni calificación.
- **Proteína por kilo de peso**, solo si hay un peso reciente (último valor del período) y siempre mostrando qué peso se usó y de qué fecha.
- Mostrar siempre la cantidad de días con registro junto a cada promedio.

## 2. Calorías de mantenimiento a partir de peso y consumo

Método habitual: tendencia del peso suavizada (promedio móvil o media móvil exponencial, como en The Hacker's Diet) frente al promedio de calorías registradas.

`mantenimiento ≈ promedio de calorías registradas − (cambio de la tendencia del peso en kg × densidad energética) / días`

- **Densidad energética:** la cifra clásica es 7.700 kcal/kg (regla de Wishnofsky, 3.500 kcal/lb). Es una aproximación estática. Datos de CALERIE citados en la bibliografía midieron cerca de 4.858 kcal/kg a las 4 semanas y 6.569 kcal/kg a las 24 semanas: no es constante, porque el peso que se pierde al principio incluye agua y glucógeno y la proporción de masa grasa y magra cambia. El modelo dinámico de Hall es la alternativa, pero es no lineal y no sirve para despejar el consumo. Conclusión: usar 7.700 kcal/kg como convención, **declararlo** y mostrar el resultado como rango, no como cifra exacta.
- **Datos mínimos:** no hay umbral riguroso publicado. Las fuentes (proveedores de apps) sugieren 7 a 14 días para una primera estimación y 2 a 3 semanas para una estable; una usa ±0,25 % del peso por semana como criterio de «peso estable». Propuesta para MyGuide, con el Principio V: mostrar la estimación solo con **al menos 14 días en una ventana de 21** con calorías registradas **y al menos 4 pesajes** en esa ventana, repartidos (el primero y el último en los extremos). Con menos, mostrar cuántos faltan.
- **Sesgos a explicar:** el registro incompleto de comida baja el promedio y sesga la estimación hacia un mantenimiento menor; el peso varía por agua, sal y ciclo hormonal; el cambio de glucógeno al cambiar carbohidratos. Por eso es «una estimación de lo que se registró», no el gasto real.
- **Presentación:** rango (por ejemplo ±150 kcal según la dispersión), método a la vista en lenguaje simple, y sin recomendar comer más o menos. Es información, no un objetivo nuevo: el objetivo de la spec 004 solo lo cambia la persona.

## 3. Medidas de entrenamiento comparables en el tiempo

- **Series efectivas por grupo muscular y semana:** es la unidad práctica más usada en la bibliografía de volumen (secundaria: rangos de 10 a 20 series por semana citados desde metaanálisis). Se discute cuánto cuenta cada ejercicio por músculo secundario («volumen fraccionado»).
- **Carga máxima por ejercicio y volumen (repeticiones × peso):** ya cubiertos por la spec 012.
- **Esfuerzo percibido y frecuencia semanal:** el esfuerzo está en la spec 012; la frecuencia es el conteo de sesiones por semana (también 012).
- **Para MyGuide:** los ejercicios del catálogo tienen músculos principales, así que se puede contar **series registradas por grupo muscular principal y semana**, sin fraccionar y sin comparar con rangos «recomendados» (Principio IV). Solo series con datos; las sin dato no se cuentan y se avisa.

## 4. Progreso sin metas, rachas ni juicios

- Mostrar números con unidad, fechas y cantidad de datos, comparar contra el propio período anterior (como la spec 012) y no contra un ideal.
- Sin colores de aprobación (verde/rojo), sin flechas de «mejora»; la diferencia es una resta con signo.
- Estados vacíos y de pocos datos explícitos.

## 5. Cruces entre sueño, entrenamiento y alimentación

- La bibliografía encontrada es de atletas y de muestras pequeñas, con efectos chicos (r ≈ 0,28 entre sueño y bienestar autoinformado; sin relación con un salto) y con resultados mixtos. Hay causalidad en ambos sentidos: el calendario de entrenamiento determina cuánto se duerme. Con muestras personales chicas aparecen correlaciones por azar (inferencia propia, sin fuente específica).
- **Propuesta honesta:** no calcular coeficientes de correlación ni frases del tipo «dormís peor cuando…». En su lugar, **mostrar dos series una debajo de la otra con el mismo eje de fechas** (sueño y, por ejemplo, volumen de entrenamiento o calorías) y dejar que la persona mire. Opcional más adelante y con umbral: agrupar los días en «durmió menos de X h» y «X h o más» y mostrar el promedio de la otra medida con la cantidad de días de cada grupo, nunca una conclusión.
- Sueño y pasos son opcionales (spec 007): el cruce solo usa los días con dato.

## Decisiones propuestas para la spec 010

1. Pantalla «Tendencias» con tres secciones: **Alimentación**, **Mantenimiento estimado** y **Entrenamiento y sueño**.
2. Todo se calcula en el navegador desde datos existentes; sin tablas nuevas ni dependencias.
3. Sin coeficientes de correlación, sin metas, sin rachas, sin colores de juicio.
4. Mantenimiento: ventana de 21 días, mínimo 14 días con calorías y 4 pesajes; 7.700 kcal/kg declarado; resultado en rango.
5. Cruces: series apiladas con eje común y tabla equivalente.

## Fuentes consultadas

- Adaptive TDEE y calculadoras de mantenimiento (proveedores): https://fitnessvolt.com/tdee-calculator/adaptive-tdee/ · https://fitnessvolt.com/maintenance-calories/
- The Hacker's Diet, tendencia del peso: https://fourmilab.ch/hackdiet/www/subsubsection1_2_4_0_5_2.html
- Densidad energética del cambio de peso y modelos dinámicos (Hall): https://pmc.ncbi.nlm.nih.gov/articles/PMC3810417/ · https://pmc.ncbi.nlm.nih.gov/articles/PMC4442575
- Series semanales por grupo muscular: https://weightology.net/?p=3935 · https://muscleevo.net/sets-build-muscle/
- Sueño y rendimiento: https://pubmed.ncbi.nlm.nih.gov/29478381/ · https://digitalcommons.wku.edu/ijesab/vol11/iss11/73
