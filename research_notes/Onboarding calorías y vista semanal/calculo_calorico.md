# Cálculo del objetivo calórico diario (TDEE, gasto de entrenamiento, ajuste por objetivo) para una app de fitness en español

Convenciones de este documento: "Cited Findings" = hecho respaldado por la fuente enlazada; "Inferences" = propuesta de diseño o convención mía (NO evidencia), pensada para que el desarrollador la implemente y la pueda revisar. Unidades métricas. Cuando una cifra proviene de un resumen secundario (no del paper), se indica. Varias fuentes primarias (PubMed, MDPI, Springer) no se pudieron abrir en esta sesión; esos casos se señalan.

---

## 1. Ecuaciones de metabolismo basal/reposo: Mifflin-St Jeor vs Harris-Benedict vs Katch-McArdle vs Cunningham

### Takeaway
Para adultos sin % de grasa conocido, Mifflin-St Jeor es la mejor opción general (revisión ADA 2005: la más a menudo dentro de ±10 % de lo medido), pero igualmente falla en ~1 de cada 4-5 individuos. Katch-McArdle/Cunningham sólo si hay % de grasa fiable; en lectores de gimnasio muy musculados todas las ecuaciones tienden a subestimar. Si el sexo no se informa no existe estándar publicado: usar el promedio de las dos constantes es una convención.

### Cited Findings
- Mifflin et al. 1990 (AJCN 51:241-247): derivada en 498 sujetos sanos de 19-78 años (normopeso y obesos), medición por calorimetría indirecta. Regresión completa: 9,99·peso + 6,25·talla − 4,92·edad + 166·sexo − 161. Versión simplificada por sexo: hombres 10·peso(kg) + 6,25·talla(cm) − 5·edad(años) + 5; mujeres la misma expresión con −161. — [QxMD/Mifflin](https://calculate.qxmd.com/storage/calculators/846/Mifflin-StJeorEquation.html); [JCI Insight ref. del paper original](https://insight.jci.org/references/scholar/5796/B66) (fuentes secundarias del texto del paper; no se abrió el paper completo)
- El mismo trabajo informa que Harris-Benedict de 1919 sobreestimó el REE medido en ~5 %. — [JCI Insight ref.](https://insight.jci.org/references/scholar/5796/B66) (resumen secundario)
- Frankenfield, Roth-Yousey, Compher 2005 (J Am Diet Assoc 105:775-789), revisión sistemática en adultos no obesos y obesos: de Harris-Benedict, Mifflin-St Jeor, Owen y OMS/FAO/UNU, Mifflin predijo el REE dentro de ±10 % de lo medido en más individuos que cualquier otra y tuvo el rango de error más estrecho. Los autores advierten errores relevantes a nivel individual y la subrepresentación de adultos mayores y minorías étnicas, y recomiendan criterio clínico. — [Penn State Pure](https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/) (DOI 10.1016/j.jada.2005.02.005)
- Estudio previo del mismo grupo (2003): el valor calculado difería >10 % del medido en 22 % de los sujetos con Mifflin y en 33 % con Harris-Benedict. — [PubMed 12963943](https://pubmed.ncbi.nlm.nih.gov/12963943/) (cifra tomada de un resumen secundario; no verificada en el paper; NO es la revisión 2005)
- Katch-McArdle: TMB = 370 + 21,6 × masa magra (kg). Cunningham: RMR = 500 + 22 × masa magra (kg). Ejemplo ACE: 80 kg con 10 % de grasa → MM 72 kg → 1.925 kcal (Katch-McArdle) y 2.084 kcal (Cunningham). Ambas dependen de un % de grasa preciso. — [ACE Fitness](https://www.acefitness.org/certifiednewsarticle/2882/resting-metabolic-rate-best-ways-to-measure-it-and-raise-it-too/); [Nutrium](https://wp.nutrium.com/cunningham-equation-for-nutrition-professionals/); [Libretexts](https://med.libretexts.org/Courses/Irvine_Valley_College/Physiology_Labs_at_Home/04%3A_Metabolism_and_Calorie_Burn/4.02%3A_Part_B._Calculating_RMR_based_off_of_Lean_Body_Mass_(LBM))
- Harris-Benedict revisada (Roza y Shizgal 1984): hombres 88,362 + 13,397·peso + 4,799·talla − 5,677·edad; mujeres 447,593 + 9,247·peso + 3,098·talla − 4,330·edad. IC 95 % ±213 kcal/día (hombres) y ±201 kcal/día (mujeres). — [Wikipedia H-B (coeficientes)](https://en.wikipedia.org/wiki/Harris%E2%80%93Benedict_equation); [Roza & Shizgal, PMID 6741850 vía wikidp](https://wikidp.org/Q34267867)
- Atletas recreativos (n=90): Harris-Benedict, OMS, Schofield, Mifflin y Owen tuvieron <50 % de exactitud; Cunningham y la ecuación nueva de ten Haaf (basada en peso) funcionaron igual de bien. — [ten Haaf & Weijs 2014, PMC4183531](https://pmc.ncbi.nlm.nih.gov/articles/PMC4183531)
- Metaanálisis 2023 en atletas: Cunningham (1980 y 1991), Harris-Benedict, De Lorenzo y ten Haaf no difirieron significativamente del RMR medido; ten Haaf fue la más precisa (80,2 % dentro de ±10 %). — [PubMed 37632665](https://pubmed.ncbi.nlm.nih.gov/37632665/) (vía resumen secundario; PubMed no se pudo abrir)
- Estudio en atletas de físico muscular (2019): casi todas las ecuaciones basadas en peso o masa libre de grasa no tuvieron validez aceptable y tendieron a subestimar el RMR; ten Haaf y Cunningham "posiblemente aceptables". — [Texas Tech](https://scholars.ttu.edu/en/publications/resting-metabolic-rate-in-muscular-physique-athletes-validity-of--5) (vía resumen secundario)
- Desacuerdo de atribución/rendimiento: Katch-McArdle y Cunningham se describen como adecuadas para personas magras/musculosas, pero otra fuente dice que Cunningham se desarrolló en atletas y tiende a sobreestimar. — [Libretexts / Nutrium arriba](https://wp.nutrium.com/cunningham-equation-for-nutrition-professionals/)

### Inferences
- Algoritmo propuesto (convención + evidencia): RMR = Mifflin-St Jeor por defecto. Hombre: `10·kg + 6.25·cm − 5·edad + 5`. Mujer: `10·kg + 6.25·cm − 5·edad − 161`. Ejemplos de prueba: hombre 80 kg, 178 cm, 30 a = 1.767,5 kcal; mujer 65 kg, 165 cm, 30 a = 1.370,25 kcal.
- Sexo no informado ("prefiero no decirlo"/otro): no encontré ninguna fuente que defina esto. Propuesta: usar la constante promedio −78 (=(5−161)/2), que queda a ±83 kcal de cualquiera de las dos; mostrar rango ±10 % más ancho y permitir al usuario elegir "usar fórmula masculina/femenina" tras ver el efecto. Es una convención, no evidencia. La alternativa de preguntar "sexo asignado al nacer, solo para la fórmula" es más honesta que adivinar.
- Katch-McArdle/Cunningham sólo si el usuario ingresa % de grasa y se marca como estimación (el % autoinformado es poco fiable); si se usa, promediar con Mifflin o mostrar ambas como rango. Para el MVP, ignorar % de grasa y usar siempre Mifflin evita errores de entrada.
- Dado que ecuaciones de población general subestiman en personas musculosas, no corregir al alza a ciegas; en su lugar, mostrar ±10 % y dejar que el módulo adaptativo (sección 7) corrija. Diseñar el objeto como `{rmr, metodo, sexo_usado, rango_pct}` para poder cambiar la ecuación sin migrar datos.
- Validar entradas: edad 18-80 (Mifflin se derivó en 19-78 años), talla 120-230 cm, peso 30-250 kg; fuera de rango, no calcular.

### Gaps
- No se verificó el texto completo de Frankenfield 2005 (no pude confirmar los porcentajes exactos dentro de ±10 %). No se encontraron cifras fiables de 82 %/70 % que circulan en internet.
- Coeficientes de ten Haaf (peso-talla-edad) no verificados en esta sesión (recuerdo vagamente una forma lineal con peso, talla en m, edad y sexo, pero no la incluyo sin fuente); verificar en PMC4183531 antes de usarla.
- Coeficientes de Harris-Benedict original 1919 no verificados en esta sesión (no se usan en la recomendación).
- No hay literatura encontrada sobre qué hacer cuando el sexo no se proporciona.

---

## 2. Factores de actividad y cómo mapear "trabajo + días de entrenamiento" sin duplicar

### Takeaway
Los multiplicadores clásicos (1,2 a 1,9) mezclan trabajo y ejercicio; usarlos junto con un gasto de sesión suma el entrenamiento dos veces. El enfoque más defendible: factor base de actividad NO ejercicio (según el trabajo) × RMR, más el gasto neto de cada sesión registrada, promediado diariamente.

### Cited Findings
- FAO/OMS/UNU 2004, Tabla 5.3 (PAL = gasto total / metabolismo basal): sedentario/ligero 1,40-1,69; activo/moderadamente activo 1,70-1,99; vigoroso 2,00-2,40 (>2,40 "difícil de mantener a largo plazo"). — [FAO Human Energy Requirements, cap. 7](https://www.fao.org/4/y5686e/y5686e07.htm)
- El mismo informe: el PAL no debe basarse sólo en la ocupación; una hora diaria de ejercicio moderado-vigoroso puede subir el PAL medio de 1,55 (categoría sedentaria) a 1,75 (moderadamente activo), es decir ~+0,20. Sedentario = ocupación de poco esfuerzo, poca caminata, sin ejercicio regular. — [FAO](https://www.fao.org/4/y5686e/y5686e07.htm)
- EFSA 2013 (opinión sobre valores de referencia de energía): REE (Henry 2005) × PAL 1,4 / 1,6 / 1,8 / 2,0, que reflejan estilos de vida de baja actividad (sedentario), moderadamente activo, activo y muy activo; los PAL se definen por tipo de trabajo, ejercicio diario y tareas domésticas; masa corporal de referencia con IMC 22. — [EFSA Journal 3005](https://efsa.europa.eu/en/efsajournal/pub/3005); [EFSA glosario PAL](https://www.efsa.europa.eu/en/glossary/physical-activity-level-pal)
- Nota de discrepancia: la nota de prensa de EFSA usa etiquetas distintas (sedentario, moderadamente activo, muy activo, altamente activo) para los mismos valores. — [EFSA press 130110](https://www.efsa.europa.eu/en/press/news/130110) vs resumen en búsqueda arriba

### Inferences
- Opción recomendada (mapeo propuesto, convención anclada a FAO/EFSA): `TDEE = RMR × F_base + (kcal_netas_semanales_de_entrenamiento / 7)`.
  - F_base debe representar vida cotidiana sin ejercicio estructurado. Propuesta: trabajo de escritorio/sedentario 1,35; mixto o de pie parte del día 1,50; de pie/caminando casi todo el día o físico 1,65. Los valores caen dentro/por debajo de la banda 1,40-1,69 de FAO para "sedentario/ligero" (FAO usa 1,55 como sedentario sin ejercicio); se eligió el extremo bajo del rango para no sobrestimar, porque sobrestimar el TDEE perjudica sobre todo a quien busca bajar de grasa. Es criterio de diseño, no evidencia.
  - Evitar usar a la vez 1,375/1,55/1,725 (multiplicadores clásicos "por días de ejercicio") y el gasto por sesión: es doble conteo. Si por simplicidad se usa sólo el multiplicador clásico, no sumar entrenamiento, y avisar que no responde a lo registrado.
- Verificación de consistencia: la regla de FAO (+0,20 PAL por 1 h/día) ≈ 0,20 × RMR 1.700 ≈ 340 kcal/día, del mismo orden que el gasto neto de una hora a 5-6 MET con 70 kg (280-350 kcal), lo que respalda sumar el gasto neto por separado.
- Los factores clásicos 1,2 / 1,375 / 1,55 / 1,725 / 1,9 son convención popular (Harris-Benedict/ACE); no verifiqué una fuente primaria en esta sesión, por lo que no los cito como evidencia.
- Si el usuario no registra entrenamiento todavía (onboarding), estimar usando los "días de entrenamiento por semana" declarados × duración típica × MET por defecto, y sustituir por lo registrado cuando exista.

### Gaps
- No se encontró una fuente que valide el mapeo concreto "tipo de trabajo → factor sin ejercicio" (1,35/1,50/1,65 son propuestas).
- Tabla de PAL clásicos 1,2-1,9 sin fuente primaria obtenida.

---

## 3. Gasto energético del entrenamiento de fuerza (METs, kcal por sesión, incertidumbre)

### Takeaway
El Compendio de Actividades Físicas da 3,5 METs (varios ejercicios, 8-15 rep), 5,0 (sentadilla/peso muerto) y 6,0 (levantamiento vigoroso/powerlifting/culturismo). Con 60 min y 70 kg, el gasto neto va de ~175 a ~350 kcal, pero la estimación es incierta (la calorimetría subestima el coste anaeróbico) y debe mostrarse como rango.

### Cited Findings
- Compendio (tabla comparada 1993/2000/2011/2024): 02050 = 6,0 MET (pesas libres/máquinas, powerlifting o culturismo, esfuerzo vigoroso); 02052 = 5,0 (sentadilla, peso muerto, esfuerzo lento o explosivo); 02054 = 3,5 (varios ejercicios, 8-15 repeticiones con resistencia variable); 02055 = 5,8 (circuito de fuerza, superseries recíprocas); 02056 = 3,0 (ejercicios de peso corporal, general); 02057 = 6,5 (peso corporal, alta intensidad); 02034 = 3,5 (circuito ligero); 02035 = 5,0 (circuito moderado); 02061 = 5,0 (clases de gimnasio generales, pesas combinadas). — [PA Compendium, Conditioning exercise](https://pacompendium.com/conditioning-exercise); [Tabla comparada 2024 (PDF)](https://pacompendium.com/wp-content/uploads/2025/02/4_2024_adult-compendium-tracking-guide-1-2024.pdf)
- La tabla comparada del PDF muestra 02050 = 6,0 en las columnas 1993, 2000 y 2011, mientras 02052 (5,0) y 02054 (3,5) aparecen desde la columna 2011/2024; códigos de la versión de adultos mayores difieren (no mezclar). — [Tabla comparada 2024 (PDF)](https://pacompendium.com/wp-content/uploads/2025/02/4_2024_adult-compendium-tracking-guide-1-2024.pdf); [Compendio adultos mayores](https://pacompendium.com/older-adult-compendium/)
- Revisión de alcance 2024 (Sports Medicine, 166 estudios): los valores de gasto en entrenamiento de fuerza varían mucho entre estudios; la calorimetría indirecta (136 estudios) probablemente ignora una fracción significativa del coste energético porque no hay estado estable y hay contribución anaeróbica; en el campo, los METs pueden ser más apropiados que la calorimetría. — [Weakley et al., Sports Med 2024 (PMC11393209)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11393209/)
- Ejemplo de un estudio citado en esa revisión/resumen: sesión de 15-RM ~310 kcal vs sesión de 5-RM ~213 kcal (37 % de diferencia), con calorimetría y lactato, medición post-ejercicio hasta 45 min. — resumen de búsqueda sobre [Weakley et al.](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11393209/) (no verificado en el paper; fuente de repositorio de Auckland)
- EPOC: revisión que resume 51 (Haltom 1999) a 127 kcal (Burleson 1998) de gasto post-ejercicio; estudio de 17 hombres entrenados (Paoli 2012): rutina tradicional (~32 min) +99 kcal a 22 h; versión de alta intensidad +452 kcal a 22 h (diferencia sobre el reposo). Datos en mujeres escasos. — [Kravitz, UNM](https://www.unm.edu/~lkravitz/Article%20folder/ExerciseAfterburn2015.html); resumen de búsqueda sobre Paoli 2012 (no verificado en el paper)

### Inferences
- Fórmula propuesta (estándar del Compendio): `kcal_netas = (MET − 1) × peso_kg × horas_activas`, restando 1 MET (reposo) para no duplicar el RMR que ya está dentro del factor base. Bruto = MET × kg × h.
- Tabla de MET por defecto propuesta para entrada de sesión: ligera/general (02054) 3,5; moderada con circuito o supersets (02055/02035) 5,0-5,8; pesada con básicos (02052) 5,0; vigorosa (02050) 6,0. Ejemplo 70 kg × 1 h: 3,5 MET → 175 kcal netas (245 brutas); 5,0 → 280 netas; 6,0 → 350 netas. A 45 min: 3,5 MET → ~131 netas.
- Presentación honesta: mostrar un rango (por ejemplo −30 %/+30 % del central, o un MET bajo y uno alto) y un texto del tipo "estimación aproximada; el gasto real varía según la intensidad, los descansos y la persona". Usar duración de la sesión descontando calentamiento y descansos muy largos, o aplicar el MET bajo si el usuario descansa mucho.
- No sumar EPOC por separado en el MVP (pequeño y muy variable, 50-130 kcal en los estudios clásicos); queda dentro del margen del rango. Efecto en el objetivo: 3 sesiones/semana × ~200 kcal netas ≈ 85 kcal/día. Conviene mostrar al usuario que el entrenamiento mueve el objetivo poco frente al factor base.
- Cardio: usar misma fórmula con el MET del Compendio correspondiente (fuera del alcance de las fuentes recogidas aquí).
- La ventana de datos y fuentes del Compendio se refieren a promedio poblacional; no hay evidencia aquí de ajuste por sexo, composición corporal o nivel de entrenamiento.

### Gaps
- No verifiqué que la versión 2011 del Compendio contenga exactamente 02052 = 5,0 y 02054 = 3,5 (la tabla comparada lo sugiere por la disposición de columnas, pero el layout del PDF es ambiguo). Los valores de 2024 sí están confirmados.
- No encontré rangos medidos de kcal por sesión de 60 min por sexo en una fuente primaria; los ejemplos de kcal son cálculos con MET, no mediciones.
- Cifras de Paoli 2012 y de Osterberg & Melby 2000 sólo vía resúmenes secundarios.

---

## 4. Ajustes por objetivo: superávit para ganancia muscular, déficit para pérdida de grasa y recomposición

### Takeaway
Ganancia: ~+10-20 % sobre mantenimiento en principiantes/intermedios (+5-10 % en avanzados), apuntando a 0,25-0,5 % del peso por semana. Pérdida: 0,5-1 % del peso por semana (evidencia en deportistas de fuerza favorece ~0,7 % sobre 1,4 %), con pisos de ingesta y sin déficits agresivos en gente magra. Recomposición: mantenimiento o déficit/superávit pequeño con proteína alta y entrenamiento progresivo, con mejor respaldo en principiantes o personas con exceso de grasa.

### Cited Findings
**Ganancia muscular**
- Iraki, Fitschen, Espinar, Helms 2019 (revisión narrativa, Sports 7:154): novatos/intermedios ~+10-20 % sobre mantenimiento con ganancia de peso ~0,25-0,5 % por semana; avanzados +5-10 % (Tabla 1) y ~0,25 %/semana; un superávit agresivo puede dar ganancia de grasa innecesaria; en atletas entrenados el grupo con superávit mayor ganó ~1,1 kg de grasa frente a 0,2 kg en el grupo ad libitum; sugieren 200-300 kcal/día de superávit en altamente entrenados frente a 500 kcal. — [Iraki 2019, PMC6680710](https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710/); [resumen abstract](https://pubmed.ncbi.nlm.nih.gov/31247944/)
- La misma revisión contiene una inconsistencia numérica ("42-48 kcal/kg" de superávit no concuerda con 10-20 % de ~45 kcal/kg); tratar con cautela. — [Iraki 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710/)
- ISSN 2017 (Aragon et al.): no da porcentaje ni kcal fijos; los superávits mayores convienen a los no entrenados o con alto NEAT y los menores a los avanzados; ejemplo: no entrenados con ~2.010 kcal/día de superávit ganaron 2,9 kg de masa magra y 0,2 kg de grasa; atletas de élite ~544 kcal sobre mantenimiento ganaron 1,1 kg de grasa. — [ISSN Diets & Body Composition, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)

**Pérdida de grasa**
- Helms, Aragon, Fitschen 2014 (revisión narrativa, evidencia "extremadamente limitada"): pérdida de ~0,5-1 % del peso por semana para maximizar la retención muscular; un déficit de 500 kcal/día da teóricamente ~0,45 kg/semana pero el modelo estático es imperfecto; se espera adaptación metabólica; déficits mayores = más pérdida de masa magra, sobre todo si se es más magro. Sin piso calórico numérico. — [Helms 2014, PMC4033492](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/)
- Garthe et al. 2011 (n=24 atletas, ECA): 0,7 %/semana (lento) vs 1,4 %/semana (rápido); los autores recomiendan ~0,7 %/semana para ganar/mantener masa magra y fuerza con entrenamiento de fuerza; tras 12 meses no hubo diferencias significativas entre grupos. — [Garthe (registro SPONET)](https://www.sponet.de/sponet/Record/4020931); [seguimiento](https://lida.sport-iat.de/ta/Record/4023821) (resumen de búsqueda; resultados detallados no verificados)
- ISSN 2017: cuanto mayor la grasa corporal basal, más agresivo puede ser el déficit; las pérdidas más lentas preservan mejor la masa magra en sujetos más magros; dietas muy bajas en energía = 400-800 kcal/día y bajas = 800-1.200 kcal/día, con "relevancia limitada para poblaciones sanas y atléticas"; un déficit de 80 % de los requerimientos redujo la síntesis proteica muscular a 10 días. — [ISSN, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)
- Regla de 3.500 kcal/lb (≈7.700 kcal/kg): implica ~78 % grasa y ~22 % tejido magro; densidades energéticas: grasa 39,5 MJ/kg (~9.440 kcal/kg), magro 7,6 MJ/kg (~1.820 kcal/kg). Hall et al. 2011 (Lancet 378:826-837): la regla ignora adaptaciones del metabolismo en reposo y del coste de la actividad; la respuesta del peso a un cambio de ingesta es lenta (semividas ~1 año). — [MacroFactor V3](https://macrofactor.com/expenditure-v3/); [Hall Lancet Web Appendix (NIDDK)](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf); [resumen Hall 2011](https://www.globalfamilydoctor.com/Resources/A-Ztopiclisting/JournalWatch/Modelstoquantificationweightgainandweightloss.aspx)
- Pisos calóricos (fuentes de baja calidad/secundarias): 1.200 kcal mujeres y 1.500 kcal hombres, atribuidos a Harvard Health; NIH con rangos algo distintos (1.000-1.200 mujeres, 1.200-1.600 hombres); por debajo de ~800 kcal se considera dieta muy baja en calorías con supervisión clínica. Tasa segura de 0,5-1 kg/semana (NHS, vía sitios de farmacia). Las fuentes no concuerdan en déficit diario (500 vs 600 kcal) ni se obtuvo el documento primario de NHS/NICE/Harvard. — [Livestrong](https://www.livestrong.com/article/320586-what-is-the-least-amount-of-calories-i-can-eat-in-a-day/); [Bolt Pharmacy](https://www.boltpharmacy.co.uk/guide/how-many-calories-a-day-to-be-in-a-deficit)
- MacroFactor expresa la meta como % del peso por semana (0,5 % ≈ 1 lb/sem a 200 lb), no fuerza recortes para "recuperar" y, ante calorías muy bajas, prioriza grasa en un nivel seguro, luego proteína, luego carbohidratos; no se encontró un piso calórico publicado. — [MacroFactor help](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal); [MacroFactor filosofía](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)

**Recomposición**
- Barakat et al. 2020 (Strength & Conditioning Journal 42(5):7-21): concluye que la recomposición en entrenados es posible bajo ciertas condiciones: entrenamiento de fuerza progresivo, proteína suficiente, estado energético moderado (pequeño déficit, mantenimiento o leve superávit), sueño y control del estrés de entrenamiento. Detalles tomados de resúmenes secundarios (blogs/podcast); el rango de proteína atribuido (1,6-2,4 g/kg) no se verificó. — [registro del paper](https://lida.sport-iat.de/ta/Record/4066252?lng=en); [resumen](https://getfitcraft.com/science/body-recomposition-research)
- Longland et al. 2016 (AJCN, 40 hombres jóvenes, 4 semanas, déficit ~40 % bajo requerimientos, entrenamiento intenso 6 días/sem): 2,4 g/kg/día de proteína frente a 1,2 g/kg aumentó la masa magra (~+1,2 kg vs ~+0,1 kg) y redujo más la grasa (~−4,8 vs −3,5 kg) según resúmenes secundarios. Muestra pequeña, prueba de concepto, protocolo muy exigente. — [PubMed 26817506](https://pubmed.ncbi.nlm.nih.gov/26817506/); [medicalresearch.com](https://medicalresearch.com/?p=21100)
- ISSN: Antonio et al.: un grupo de mayor proteína perdió más grasa (1,6 vs 0,3 kg) con ganancia de magro similar en 8 semanas; recomposición presentada como especulativa. — [ISSN, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)

### Inferences
- Parámetros propuestos (convención basada en las fuentes; todos configurables y mostrados como rangos):
  - **Ganar músculo:** objetivo = TDEE × (1 + s). s por experiencia: principiante 0,15 (rango 10-20 %), intermedio 0,10 (10-15 %), avanzado 0,05 (5-10 %). Tope absoluto ≈ +500 kcal/día. Ritmo de control: 0,25-0,5 % del peso/semana (novato/intermedio), ~0,25 % (avanzado). Un valor por defecto cercano al extremo bajo es más seguro ante la incertidumbre del TDEE.
  - **Perder grasa:** objetivo = TDEE × (1 − d), d por defecto 0,15-0,20 (≈ 0,4-0,6 % del peso/semana para la mayoría), máximo recomendado 0,25 y ritmo máximo 0,75-1 % del peso/semana; limitar más (d ≤ 0,15-0,20) si el usuario es magro (IMC <22 o grasa baja). Conversión informativa: kcal/día ≈ (kg/sem × 7.700)/7; p. ej. 0,5 % de 80 kg = 0,4 kg/sem ≈ 440 kcal/día. Hall implica que esta conversión sobrestima la pérdida a mediano plazo, por lo que es mejor expresar el déficit como % de TDEE y revisar con tendencia real.
  - **Piso:** `objetivo ≥ max(1.200 mujeres / 1.500 hombres, ~RMR calculado)`; con sexo no informado usar 1.500; nunca proponer <1.200 kcal; si el piso recorta el déficit pedido, avisar y no empujar más. El piso de 1.200/1.500 es convención (fuentes secundarias y discordantes), no resultado de estudio.
  - **Recomposición:** objetivo = TDEE (rango −10 % a 0 %), proteína alta y entrenamiento de fuerza progresivo; ofrecerla como opción sobre todo a principiantes, personas que retoman el entrenamiento o con exceso de grasa; para avanzados y magros avisar que el cambio será lento y que alternar fases de superávit/déficit suele ser más práctico (esto último es opinión; las fuentes recogidas sólo dicen "posible bajo condiciones"). Si el usuario es avanzado y magro, desalentar la expectativa.
- Desacuerdos a documentar: (a) Helms 0,5-1 %/sem vs Garthe 0,7 % > 1,4 %: son compatibles, lo prudente es la zona baja; (b) los pisos 1.200/1.500 (Harvard vía secundaria) vs rangos NIH más bajos: se adopta el más alto como convención conservadora; (c) 7.700 kcal/kg es una aproximación estática (Hall).

### Gaps
- No se obtuvo el texto de Barakat 2020 ni cifras exactas de su revisión.
- Ninguna fuente primaria obtenida para el piso calórico por sexo ni para el déficit en % de TDEE para población general sedentaria con sobrepeso (todo lo consultado es de culturismo/atletas o resúmenes de farmacias).
- No se leyó la parte final (~145 k caracteres) de Helms 2014 ni de Iraki 2019 (~69 k caracteres).

---

## 5. Proteína y otros macronutrientes por objetivo (salida opcional)

### Takeaway
1,6 g/kg es el punto de quiebre del metaanálisis de Morton (con IC amplio y sugerencia de 2,2 g/kg como objetivo prudente); ISSN da 1,4-2,0 g/kg general y 2,3-3,1 g/kg de masa libre de grasa sólo en deportistas magros en déficit. Grasa 0,5-1,5 g/kg o 15-30 % kcal; carbohidratos el resto, ≥3-5 g/kg en volumen.

### Cited Findings
- Morton et al. 2018 (BJSM 52:376-384; 49 ECA, 1.863 participantes): la suplementación proteica aumentó fuerza y masa libre de grasa durante entrenamiento de fuerza prolongado; por encima de una ingesta total de 1,62 g/kg/día no hubo más ganancia de masa libre de grasa; el efecto fue menor con la edad y mayor en entrenados. El punto de quiebre tiene IC amplio (según comentario secundario, los autores sugieren ~2,2 g/kg como objetivo cauteloso). — [PubMed 28698222 (resumen vía búsqueda)](https://pubmed.ncbi.nlm.nih.gov/28698222/); [Stronger By Science](https://www.strongerbyscience.com/?p=61316); [AUT](https://openrepository.aut.ac.nz/items/8dea98a4-4e37-4c60-be43-4b6ece0bd9a5/full) (PubMed no se pudo abrir; IC exacto no verificado)
- ISSN Protein & Exercise (Jäger 2017): 1,4-2,0 g/kg/día suficiente para la mayoría de quienes quieren construir o mantener músculo; 2,3-3,1 g/kg pueden ayudar a retener masa magra en entrenados en restricción calórica; dosis ~0,25 g/kg (20-40 g) cada 3-4 h; sin daño renal/óseo en sanos activos. — [PubMed 28642676](https://pubmed.ncbi.nlm.nih.gov/28642676/); [PMC5477153](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/)
- ISSN dietas (Aragon 2017): 2,3-3,1 g/kg de masa libre de grasa en entrenados magros durante déficit. Helms 2014: 2,3-3,1 g/kg de masa magra, grasa 15-30 % de las kcal, carbohidratos el resto, evitar dietas muy bajas en carbohidratos. — [PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/); [PMC4033492](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/)
- Iraki 2019 (volumen): proteína 1,6-2,2 g/kg/día (0,40-0,55 g/kg por comida), grasa 0,5-1,5 g/kg/día, carbohidratos ≥3-5 g/kg/día. — [PMC6680710](https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710/)
- Nota: ISSN 2017 y Helms 2014 son revisiones; Helms indica expresamente que sus rangos son en parte extrapolación. — [Helms 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/)

### Inferences
- Salida propuesta (g/kg de peso corporal, no de masa magra, para evitar depender del % de grasa): ganar músculo 1,6-2,2; recomposición 1,8-2,4; perder grasa 1,8-2,4 (2,0 por defecto), tope informativo 2,5; los 2,3-3,1 g/kg de masa magra son para atletas magros en prep y no deben usarse como objetivo general. Grasa: ≥0,6-0,8 g/kg (convención) y 20-30 % de kcal; carbohidratos = resto. En personas con mucho sobrepeso, calcular proteína sobre peso objetivo/ajustado (convención).
- Derivación: kcal_proteína = 4 × g, grasa 9 kcal/g, carbohidratos 4 kcal/g; si carbohidratos resultan <3 g/kg en volumen/recomposición, mostrar un aviso suave.
- Cualquier cifra de proteína debe mostrarse como rango.

### Gaps
- IC 95 % exacto del quiebre de Morton (comúnmente citado como ~1,03-2,20) no verificado.
- No se obtuvo un position stand de ACSM/AND/DC con valores para verificar el cruce de fuentes.

---

## 6. Enfoque adaptativo (tipo MacroFactor): comparar fórmula contra tendencia real

### Takeaway
La expenditure real se estima como ingesta promedio menos el cambio de energía almacenada inferido de la tendencia de peso (no del peso diario), con ventana de ~3 semanas; MacroFactor exige peso ≥1 vez/semana y comida ≥4 días/semana. El MVP puede replicar una versión simple y mostrarla junto a la fórmula.

### Cited Findings
- MacroFactor calcula el gasto a partir de la tendencia de peso y la ingesta; usa unas tres semanas de datos; el peso diario fluctúa por agua, glucógeno y contenido intestinal. Mínimos: peso al menos 1 vez/semana (idealmente a diario) y alimentos al menos 4 días/semana; si falta, el cálculo se pausa ("holding"). — [MacroFactor help: peso](https://help.macrofactorapp.com/en/articles/109-how-frequently-do-i-need-to-log-my-weight-for-the-expenditure-algorithm-and-weekly-coaching-updates); [help: nutrición](https://help.macrofactorapp.com/en/articles/110-how-frequently-do-i-need-to-log-my-nutrition-for-the-expenditure-algorithm-and-weekly-coaching-updates); [help: interpretar cambios](https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure)
- V3: ciclo predecir-comparar-actualizar; no menciona un filtro de Kalman; estima la ingesta de días no registrados (error medio ~13 %, >90 % de errores <30 %); solo pausa si faltan más de 3 días de nutrición en 7; supuestos simétricos para ganar y perder (V1/V2 asumían déficits y superávits distintos para el mismo ritmo); estimación inicial con ecuaciones de TMB y multiplicadores propios, no publicados; la estimación inicial se estabiliza tras ~14-30 días. — [MacroFactor V3](https://macrofactor.com/expenditure-v3/); [MacroFactor filosofía](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)
- La meta se convierte del ritmo (% del peso/semana) al tamaño del déficit/superávit aplicado al gasto estimado. — [MacroFactor filosofía](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/)
- Densidades de tejido: grasa 39,5 MJ/kg, magro 7,6 MJ/kg; la regla de 3.500 kcal/lb asume ~78 % grasa. — [MacroFactor V3](https://macrofactor.com/expenditure-v3/); [Hall appendix](https://www.niddk.nih.gov/-/media/Files/BWP/Hall_Lancet_Web_Appendix.pdf)

### Inferences
- Versión simple para la app (propuesta, no es el algoritmo de MacroFactor): (1) tendencia de peso con media móvil exponencial; (2) en una ventana de 21-28 días, `TDEE_real ≈ ingesta_media − (Δpeso_tendencia_kg × ~7.700) / días` (ajustable al 7.700 con la mezcla grasa/magro); (3) exigir ≥ ~70 % de días con ingesta registrada y ≥ ~8-10 pesadas distintas en la ventana antes de mostrar nada; (4) combinar con la fórmula, por ejemplo con peso creciente de la medición a medida que hay más datos, y mostrar ambos valores con la diferencia ("tu fórmula dice X, tu tendencia sugiere Y"). Los umbrales numéricos son criterios propios.
- Cautelas a mostrar: primeras 1-2 semanas de dieta/cambio de entrenamiento distorsionadas por agua y glucógeno; la ingesta autoinformada tiende a errores; ganancia muscular simultánea sesga el resultado; no cambiar el objetivo por una sola semana.
- Guardar datos crudos (peso, ingesta, fecha) y el cálculo de fórmula en snapshots para poder recalcular.

### Gaps
- No se publica el algoritmo, coeficientes ni mínimos exactos de MacroFactor V3 (sólo requisitos de registro). Cronometer y Examine: no se pudo obtener su metodología (Examine devolvió HTTP 429; Cronometer no se consultó).

---

## 7. Seguridad, límites y redacción

### Takeaway
El MVP debe limitarse a adultos sanos (≥18 años), excluir embarazo/lactancia y personas con antecedentes de trastornos de la conducta alimentaria del cálculo automático de déficit, aplicar pisos y topes de ritmo, y redactar todo como estimación revisable.

### Cited Findings
- Mifflin se derivó en adultos de 19-78 años; Frankenfield 2005 señala subrepresentación de mayores y de minorías étnicas; ISSN 2017 reconoce falta de investigación en mujeres y personas mayores. — [JCI Insight ref.](https://insight.jci.org/references/scholar/5796/B66); [Penn State Pure](https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/); [ISSN, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)
- Helms 2014: riesgo elevado de trastornos alimentarios y de imagen corporal en culturistas (en un estudio, 46 % de culturistas varones naturales informó atracones tras la competición y 42 % de las culturistas tenía antecedentes de anorexia); deben tener acceso a profesionales de salud mental; deshidratación/manipulación de electrolitos "puede ser peligrosa". — [Helms 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/)
- EFSA 2013: energía adicional estimada en embarazo de +70 kcal/día (1.er trimestre), +260 (2.º) y +500 (3.º), con aumento de peso de referencia de 12 kg; lactancia exclusiva +500 kcal/día según EFSA (otra fuente neerlandesa usa un valor menor). — [EFSA press](https://www.efsa.europa.eu/en/press/news/130110); [Consejo de Salud NL](https://www.healthcouncil.nl/binaries/healthcouncil/documenten/advisory-reports/2022/08/16/dietary-reference-values-for-energy/Summary_Dietary-reference-values-for-energy.pdf)
- ISSN: la dieta muy baja en energía (400-800 kcal/día) tiene relevancia limitada para población sana y atlética. — [ISSN, PMC5470183](https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/)

### Inferences
- Reglas de recorte propuestas (convención): edad 18-80 (bloquear <18: crecimiento y fórmula no validada; para >65 mostrar nota de menor precisión y sugerir consultar); IMC <18,5 → no ofrecer pérdida de grasa ni déficit; IMC <16 o >45 o objetivo de pérdida con IMC <20 → derivar a profesional; embarazo/lactancia → no calcular déficit, indicar profesional (EFSA da el costo energético extra para referencia, pero la app no debe prescribir); piso kcal por sexo (sección 4); ritmo máximo 0,75-1 %/sem; superávit máximo +500 kcal/día; rechazar objetivos de peso con IMC resultante <18,5; limitar duración de déficits sin pausa (sugerir pausas de mantenimiento cada 8-12 semanas, criterio propio).
- Preguntas de cribado sin juicio (en el onboarding): "¿Estás embarazada o en lactancia?", "¿Tienes o has tenido un trastorno de la conducta alimentaria?", "¿Condición médica (diabetes, enfermedad renal, tiroides) o medicación que afecte a la dieta?". Si responde sí: mostrar solo mantenimiento/estimación y mensaje de derivación; sin cifras de déficit.
- Textos sugeridos en español: "Esto es una estimación aproximada, no un dato exacto. Tu gasto real puede ser ±10-15 % distinto." / "Revisaremos el objetivo con tu evolución real de peso e ingesta." / "No recomendamos bajar de [X] kcal sin supervisión profesional." / "Si estás embarazada o en lactancia, tienes o has tenido un trastorno de la conducta alimentaria, o tienes una condición médica, consulta con un médico o dietista-nutricionista antes de seguir este objetivo." Evitar lenguaje de culpa, "quemar", "ganarte la comida", cifras de "premio/castigo", y no mostrar contadores de "déficit" en rojo.
- Contexto de producto: la regla del proyecto es que las estimaciones se muestren como aproximadas y revisables y sin empujar restricción; coherente con el skill `nutrition-domain-rules` del repositorio (no revisado aquí).

### Gaps
- No se encontraron en esta sesión fuentes primarias (OMS, AESAN, ACSM, NICE) para edad mínima, IMC de corte, ni redacción de derivación; las reglas de IMC y edad son convenciones razonables, no estándares citados.
- Orientaciones para adolescentes (<18) y mayores de 65 no investigadas en profundidad.
- Lactancia: EFSA +500 kcal/día (según fuente secundaria); la cifra de 330 kcal que a veces se cita no se pudo confirmar.
