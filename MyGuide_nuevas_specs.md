# MyGuide --- Propuesta de nuevas specs

**Documento de diseño para convertir las ideas nuevas en specs
individuales de Spec-Driven Development.**

**Base:** estado actual de MyGuide resumido el 2026-11-25.\
**Objetivo:** aprovechar los datos que ya registra la aplicación para
pasar de un sistema de registro a un sistema que ayude al usuario a
**entender, planificar, progresar y ajustar** su entrenamiento y
alimentación.

------------------------------------------------------------------------

## 0. Contexto y criterios generales

MyGuide ya registra alimentación, entrenamiento, sueño, pasos,
actividad, peso, medidas, fotos, suplementos, objetivos calóricos,
tendencias y recordatorios. También cuenta con catálogo de alimentos y
ejercicios, sesiones y estimación de comidas mediante IA.

La siguiente etapa no debería consistir principalmente en agregar más
pantallas de registro. El foco debe ser:

> **Dato → interpretación → decisión → acción → nuevo dato.**

Ejemplo:

> 27,5 kg × 9 reps × 2 RIR\
> ↓\
> MyGuide detecta que mejoró respecto de la sesión anterior\
> ↓\
> propone intentar 10 reps la próxima vez\
> ↓\
> el usuario entrena\
> ↓\
> registra el resultado\
> ↓\
> MyGuide actualiza la progresión.

### Principios

1.  Las estimaciones se presentan como estimaciones, nunca como
    certezas.
2.  Los objetivos nutricionales muestran método, supuestos y, cuando
    corresponda, rango.
3.  No recomendar restricciones extremas ni compensaciones por haber
    comido más.
4.  No diagnosticar enfermedades ni interpretar síntomas como
    diagnóstico.
5.  Las recomendaciones de entrenamiento son modificables por el
    usuario.
6.  La aplicación no reemplaza a un profesional de salud o entrenador.
7.  Los datos históricos confirmados conservan su integridad.
8.  Las recomendaciones explican por qué fueron generadas.
9.  Los datos personales y de salud permanecen privados y sujetos a RLS.
10. IA: propone; el usuario revisa y confirma cuando corresponda.
11. Los cálculos deterministas están separados de la IA.
12. Las nuevas features respetan la Constitution y el patrón de specs
    existente.

------------------------------------------------------------------------

# 025 --- Perfil de atleta

## Objetivo

Crear un perfil suficientemente completo para que MyGuide adapte sus
recomendaciones de entrenamiento y nutrición a cada persona.

No debe ser solamente el perfil de cuenta: representa el **contexto
deportivo y de objetivos** del usuario.

## Datos

### Información corporal

-   altura
-   peso actual
-   sexo, si el usuario decide informarlo
-   edad/fecha de nacimiento, si corresponde
-   unidades
-   zona horaria

### Objetivos

Permitir uno o varios: - hipertrofia - fuerza - pérdida gradual de
grasa - mantenimiento - recomposición - rendimiento deportivo -
condición física - objetivo personalizado

Cada objetivo puede tener prioridad.

### Experiencia

-   principiante
-   intermedio
-   avanzado
-   experiencia aproximada

### Disponibilidad

-   días por semana
-   duración por sesión
-   horario habitual
-   equipamiento
-   gimnasio/casa
-   restricciones

### Preferencias

-   ejercicios favoritos
-   ejercicios que no quiere realizar
-   músculos prioritarios
-   frecuencia
-   preferencias alimentarias
-   alimentos evitados
-   cantidad habitual de comidas

### Recuperación y actividad

-   horas de sueño habituales
-   recuperación percibida
-   actividad diaria
-   pasos aproximados
-   trabajo sedentario/activo

## Funcionamiento

El perfil alimenta las demás specs.

Ejemplo:

> Hipertrofia + 4 días + 60 minutos + gimnasio completo + prioridad
> pecho/hombros.

MyGuide podrá usar esto para proponer una distribución semanal.

## Reglas

-   Campos no esenciales opcionales.
-   Perfil editable.
-   Cambios que afecten cálculos futuros deben tener fecha de vigencia.
-   No sobrescribir datos históricos con información nueva.
-   Las preferencias no se convierten en restricciones obligatorias.

------------------------------------------------------------------------

# 026 --- Macros por comida

## Objetivo

Mostrar calorías y macronutrientes de cada comida, no solamente el total
diario.

## Por comida

-   calorías
-   proteínas
-   carbohidratos
-   grasas
-   opcionalmente fibra y sodio si existe información confiable

## Ejemplo

  Alimento         kcal      Prot.      Carb.     Grasas
  ----------- --------- ---------- ---------- ----------
  Arroz             280        5 g       62 g        1 g
  Pollo             250       46 g        0 g        5 g
  Aceite             90        0 g        0 g       10 g
  **Total**     **620**   **51 g**   **62 g**   **16 g**

## Progreso diario

> Proteína: 92 / 140 g\
> Carbohidratos: 180 / 280 g\
> Grasas: 54 / 75 g

Los objetivos vienen de la spec 027 y no están hardcodeados.

## IA

Si una comida fue estimada por IA: - guardar estimación original -
permitir editar cantidades - recalcular macros determinísticamente -
marcar valores estimados - guardar confirmación del usuario

La IA no calcula el total final cuando ya existen cantidades y valores
estructurados.

------------------------------------------------------------------------

# 027 --- Estimación de necesidades de macros según objetivo

## Objetivo

Calcular una propuesta de calorías y macronutrientes diarios según
perfil, objetivo y actividad.

## Entradas

-   perfil de atleta
-   peso
-   altura
-   edad, cuando corresponda
-   objetivo
-   frecuencia de entrenamiento
-   actividad diaria
-   pasos
-   tendencia de peso
-   historial disponible
-   preferencias

## Salida

Ejemplo:

> Energía: 2.500--2.650 kcal\
> Proteína: 130--150 g\
> Grasas: 65--80 g\
> Carbohidratos: resto de energía

Mostrar: - método - supuestos - fecha - rango/incertidumbre - datos
utilizados

## Ajuste con datos reales

Después de suficientes semanas, comparar: - objetivo estimado - peso
real - actividad - adherencia

y sugerir revisar el objetivo si existe evidencia suficiente.

No reaccionar automáticamente a uno o dos pesajes.

## Seguridad

-   Evitar objetivos extremos.
-   No recomendar déficits agresivos.
-   Avisar si faltan datos.
-   Nunca presentar un número como exacto.
-   Cambios de objetivo requieren confirmación.

------------------------------------------------------------------------

# 028 --- Plan alimentario por día y actividad

## Objetivo

Generar una **propuesta de distribución alimentaria diaria** adaptada al
tipo de día.

No debe presentarse como dieta médica ni como única forma correcta de
comer.

## Tipos de día

-   descanso
-   entrenamiento
-   entrenamiento intenso
-   alta actividad
-   baja actividad

## Ejemplo

### Día de pierna

2.600 kcal

-   desayuno
-   almuerzo
-   pre-entreno
-   cena/post-entreno

### Día de descanso

2.350 kcal

-   desayuno
-   almuerzo
-   merienda
-   cena

Las diferencias deben estar justificadas por el modelo y no funcionar
como castigo o compensación.

## Generación

El usuario puede indicar: - cantidad de comidas - alimentos
disponibles - preferencias - presupuesto opcional - alimentos
excluidos - horarios - horario de entrenamiento

MyGuide propone combinaciones.

## Sustituciones

> Pollo → carne magra → atún → huevos

El sistema recalcula macros y calorías.

## Lista de compras

Opcionalmente convertir el plan semanal en: - alimentos - cantidades -
total semanal

## Reglas

-   El usuario confirma el plan.
-   El plan es editable.
-   Planificado y consumido son datos distintos.
-   El registro real prevalece sobre el plan.
-   No compensar excesos con restricciones agresivas al día siguiente.

------------------------------------------------------------------------

# 029 --- RIR/RPE y esfuerzo por serie

## Objetivo

Registrar el esfuerzo real de cada serie para interpretar mejor el
rendimiento.

## Datos

Cada serie puede incluir: - peso - repeticiones - RIR - RPE - notas
opcionales

Se puede permitir RIR o RPE según preferencia, manteniendo una
representación consistente internamente.

## Ejemplo

> Press inclinado\
> 27,5 kg × 10 --- 2 RIR

## Uso

Comparar:

> 27,5 × 10 @ 2 RIR

contra:

> 27,5 × 10 @ 0 RIR

No interpretarlos automáticamente como el mismo rendimiento.

------------------------------------------------------------------------

# 030 --- Progresión automática de entrenamiento

## Objetivo

Convertir el historial en una propuesta concreta para la siguiente
sesión.

## Ejemplo

Historial:

> 27,5 kg\
> 10 / 9 / 8 reps\
> RIR aproximado 2

Próxima sesión:

> **Objetivo sugerido:** 27,5 kg\
> **Rango:** 8--12 reps\
> **Meta:** superar el rendimiento anterior sin aumentar peso todavía.

Cuando se alcanza consistentemente el extremo superior:

> **Sugerencia:** aumentar peso y volver a la parte baja del rango.

## Factores

-   repeticiones
-   peso
-   series
-   RIR/RPE
-   historial
-   frecuencia
-   fatiga reciente
-   objetivo del ejercicio

La progresión es una sugerencia. El usuario puede aceptarla, editarla o
ignorarla.

------------------------------------------------------------------------

# 031 --- Volumen por grupo muscular

## Objetivo

Mostrar cuánto volumen recibe cada grupo muscular.

## Métricas

-   series directas
-   series indirectas
-   frecuencia semanal
-   tendencia
-   volumen por sesión

Ejemplo:

> Pecho: 10 series directas / semana\
> Espalda: 12\
> Deltoide lateral: 8\
> Bíceps: 6\
> Tríceps: 8

Comparar también con semanas anteriores.

## Reglas

No afirmar:

> "Necesitás exactamente 12 series."

Preferir:

> "Tu volumen actual de pecho es X. Si tu objetivo es hipertrofia, podés
> revisar si es sostenible y si tu rendimiento progresa."

------------------------------------------------------------------------

# 032 --- PRs y récords personales

## Objetivo

Detectar mejoras relevantes.

## Tipos

-   mayor peso
-   más repeticiones con el mismo peso
-   mejor volumen
-   mejor estimación de 1RM
-   mejor rendimiento dentro de un rango

Ejemplo:

> 🏆 Nuevo récord\
> Press inclinado --- 27,5 kg × 10

Los récords se conservan históricamente y solo cambian mediante
corrección explícita del registro original.

------------------------------------------------------------------------

# 033 --- Detección de estancamiento

## Objetivo

Detectar períodos en los que el rendimiento deja de mejorar.

## Ejemplo

> Press inclinado\
> 27,5 kg durante 5 sesiones\
> rendimiento similar

Mostrar:

> **Posible estancamiento**

Y posibles factores observables: - volumen sin cambios - esfuerzo
elevado - recuperación reducida - sueño menor - déficit energético -
poca progresión - cambio de frecuencia

No afirmar causalidad.

Ejemplo de salida:

> "Tu rendimiento lleva 5 sesiones sin una mejora clara. También se
> observa menor sueño promedio durante las últimas dos semanas."

------------------------------------------------------------------------

# 034 --- Recuperación y fatiga

## Objetivo

Relacionar entrenamiento con recuperación sin realizar diagnósticos.

## Registro

Antes: - sueño - energía - fatiga - estrés - molestias opcionales

Después: - rendimiento percibido - sesión completada - dificultad

## Análisis

Ejemplo:

> "En tus últimas 8 sesiones de pierna, 4 ocurrieron después de dormir
> menos de 6 horas. En esas sesiones el rendimiento promedio fue menor."

No decir:

> "Dormir poco causó tu caída de rendimiento."

Si la recuperación declarada es baja varios días:

> "Tu recuperación declarada viene siendo baja. Considerá revisar
> descanso y carga de entrenamiento."

------------------------------------------------------------------------

# 035 --- Adherencia al entrenamiento

## Objetivo

Medir cuánto del plan realmente se cumple.

## Métricas

-   sesiones planificadas
-   realizadas
-   porcentaje
-   series planificadas vs realizadas
-   frecuencia real
-   consistencia semanal

Ejemplo:

> 22 de 24 sesiones realizadas\
> **91,7 % de adherencia**

Permite diferenciar una rutina poco efectiva de una rutina que todavía
no tuvo suficiente consistencia para evaluarse.

------------------------------------------------------------------------

# 036 --- Analizador de rutina

## Objetivo

Analizar una rutina completa.

## Analizar

-   frecuencia
-   volumen
-   grupos musculares
-   distribución semanal
-   ejercicios repetidos
-   duración estimada
-   recuperación
-   coincidencia con objetivo

Ejemplo:

> Pecho: 14 series\
> Espalda: 6\
> Brazos: 16

> "La rutina concentra más volumen en brazos y pecho que en espalda. Si
> tu prioridad es desarrollar el torso de forma equilibrada, podrías
> redistribuir parte del volumen."

No imponer una rutina única.

------------------------------------------------------------------------

# 037 --- Recomendaciones personalizadas

## Objetivo

Unificar los datos anteriores en recomendaciones accionables.

## Ejemplo

### Esta semana

**Entrenamiento** \> Tu press inclinado mejoró 2 sesiones consecutivas.
Podés mantener el peso e intentar aumentar una repetición.

**Volumen** \> El volumen de espalda bajó respecto del promedio de 4
semanas.

**Recuperación** \> Tu sueño promedio fue menor esta semana.

**Nutrición** \> Tu consumo promedio de proteína quedó por debajo de tu
objetivo estimado.

## Cada recomendación debe mostrar

-   dato que la originó
-   período
-   nivel de confianza
-   acción sugerida
-   opción para ignorarla

No generar recomendaciones con datos insuficientes.

------------------------------------------------------------------------

# 038 --- Dashboard de progreso integral

## Objetivo

Unificar entrenamiento, nutrición, recuperación y evolución física.

## Períodos

-   7 días
-   30 días
-   90 días

## Entrenamiento

-   sesiones
-   adherencia
-   PRs
-   volumen
-   ejercicios con progreso
-   ejercicios estancados

## Nutrición

-   calorías promedio
-   proteína promedio
-   adherencia a macros
-   distribución por comida

## Recuperación

-   sueño
-   energía
-   fatiga

## Evolución

-   peso
-   medidas
-   fotos
-   tendencia

## Resumen

Ejemplo:

> Peso: estable\
> Entrenamiento: 12/13 sesiones\
> PRs: 6\
> Proteína: 91 % del objetivo promedio\
> Sueño: 7 h 05 min

> **Lectura:** mantuviste el peso mientras mejoraste varios indicadores
> de rendimiento.

Evitar afirmaciones causales no demostradas.

------------------------------------------------------------------------

# Orden recomendado de implementación

## Fase A --- Datos base

1.  025 Perfil de atleta
2.  026 Macros por comida
3.  027 Objetivos de macros
4.  029 RIR/RPE

## Fase B --- Inteligencia de entrenamiento

5.  030 Progresión
6.  031 Volumen
7.  032 PRs
8.  033 Estancamiento
9.  034 Recuperación
10. 035 Adherencia

## Fase C --- Planificación

11. 028 Plan alimentario por actividad
12. 036 Analizador de rutina
13. 037 Recomendaciones

## Fase D --- Experiencia final

14. 038 Dashboard integral

------------------------------------------------------------------------

# Modelo conceptual

``` text
                    PERFIL DE ATLETA
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
        ENTRENAMIENTO              NUTRICIÓN
             │                         │
     ┌───────┼────────┐          ┌─────┼─────┐
     ▼       ▼        ▼          ▼     ▼     ▼
    RIR    Volumen   PRs       kcal  macros comidas
     │       │        │          │     │
     └───────┼────────┘          └─────┼─────┘
             ▼                         ▼
       PROGRESIÓN                 PLAN DIARIO
             │                         │
             └──────────┬──────────────┘
                        ▼
                  RECUPERACIÓN
                        │
                        ▼
                ANÁLISIS / TENDENCIAS
                        │
                        ▼
              RECOMENDACIONES
                        │
                        ▼
                    ACCIÓN
                        │
                        ▼
                 NUEVOS DATOS
```

------------------------------------------------------------------------

# Diferencial buscado

MyGuide no debería competir por tener más pantallas, sino por utilizar
mejor los datos que ya registra.

> **"MyGuide conoce tu historial y utiliza tus propios datos para
> ayudarte a decidir qué hacer después."**

Ejemplos:

**Entrenamiento**

> "La última vez hiciste 27,5 kg × 9 con 2 RIR. Tu rendimiento viene
> mejorando. Hoy podés intentar 10 reps antes de aumentar el peso."

**Nutrición**

> "Tu objetivo estimado es 130--150 g de proteína y llevás 90 g. Si
> todavía te faltan comidas, podés distribuir el resto entre ellas."

**Recuperación**

> "Tu sueño fue menor que tu promedio habitual y hoy declaraste mayor
> fatiga. Podés tenerlo en cuenta al interpretar tu rendimiento."

------------------------------------------------------------------------

# Nota para crear las specs reales

Cada carpeta `specs/NNN-nombre/` debe seguir el formato existente:

-   `spec.md`
-   `plan.md`
-   `research.md`
-   modelo de datos
-   contratos
-   `tasks.md`
-   `verification.md`

Antes de implementar cálculos de nutrición o recomendaciones de
entrenamiento, hacer `research` específico para definir:

-   fórmulas y supuestos
-   fuentes
-   rangos y límites
-   manejo de datos faltantes
-   incertidumbre
-   reglas de seguridad
-   qué hace la aplicación y qué queda a decisión del usuario
-   qué parte es determinista y qué parte puede usar IA

La IA no debería ser necesaria para cálculos nutricionales deterministas
ni para la lógica básica de progresión.
