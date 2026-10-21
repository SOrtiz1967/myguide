# Quickstart: validar la spec 006

**Feature**: 006-rutinas-calendario-sesiones

## Requisitos previos

Los de las specs 001 a 005: Docker Desktop, `npx supabase start`, las Edge Functions servidas (`npx supabase functions serve --env-file supabase/.env.local`; el registro de cuentas las necesita), el frontend en marcha y las migraciones aplicadas. Esta spec **no agrega funciones de borde ni dependencias nuevas**. Hace falta el catálogo de ejercicios cargado para elegir ejercicios reales:

```powershell
npx supabase migration up                 # o db reset + las cargas
npm run import:ejercicios-muestra         # ~30 ejercicios de desarrollo
npm run import:ejercicios                 # catálogo real (opcional)
npm run dev --prefix app
```

## Comandos de verificación

```powershell
npm run test:db          # pgTAP: tablas, RLS, funciones, transiciones, regla de «modificada», instantáneas
npm run test:import      # Deno: sin cambios (la carga no se toca)
npm test --prefix app    # Vitest: esquemas, texto, calendario, editor de sesión, rutinas, lenguaje neutral
npm run e2e --prefix app # Playwright (por partes si falta memoria)
npm run check:secrets --prefix app
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Registrar una sesión de hoy con un ejercicio de cada tipo de medición, con dos series cada uno | 1 | Se pide solo lo que corresponde a cada tipo, con unidades (kg, repeticiones, mm:ss, km) |
| 2 | Una serie con un dato sin completar (repeticiones sin peso) | 1 | Se acepta y el peso dice «sin dato»; nunca 0 |
| 3 | Peso 0 en un ejercicio con peso | 1 | Es válido y distinto de «sin dato» |
| 4 | Valores fuera de rango (repeticiones 0 o 1.000, peso negativo, duración 0) | 1 | Se rechazan con un mensaje claro |
| 5 | Terminar la sesión | 1 | Queda «Realizada» en su día con todo lo anotado y sus unidades |
| 6 | Registrar un entrenamiento de ayer | 1 | Queda en esa fecha como realizado |
| 7 | Corregir o quitar una serie antes de terminar | 1 | Sin series duplicadas ni huecos |
| 8 | Intentar iniciar una segunda sesión con una en curso | 1 | Se ofrece continuar la abierta |
| 9 | Indicar el esfuerzo percibido de un ejercicio | 1 | Un valor de 1 a 10 para todas sus series; sin esfuerzo dice «sin dato» |
| 10 | Crear una rutina con tres ejercicios y objetivos | 2 | Se guarda en el orden elegido |
| 11 | Objetivos por tipo de medición | 2 | Cada tipo ofrece solo sus objetivos |
| 12 | Rutina sin nombre, sin ejercicios, con 0 o 21 series | 2 | Se rechaza con el motivo |
| 13 | Editar una rutina: orden y un objetivo | 2 | Se guarda; la rutina refleja el nuevo plan |
| 14 | Duplicar una rutina | 2 | Copia independiente «… (copia)» |
| 15 | Eliminar una rutina con sesiones ya creadas | 2 | Las sesiones conservan su plan |
| 16 | Una rutina con un ejercicio propio que luego se eliminó | 2 | Sigue mostrando el nombre, con aviso; se puede reemplazar |
| 17 | Doble clic en guardar la rutina; cortar la red al guardar | 2 | Una sola rutina; aviso de que no se guardó y borrador conservado |
| 18 | Iniciar una sesión desde una rutina | 3 | La sesión nace con el plan de la rutina |
| 19 | Mirar el plan y lo realizado | 3 | Bloques separados; ningún objetivo aparece como serie anotada |
| 20 | Sustituir un ejercicio durante la sesión | 3 | El plan conserva el original; lo realizado registra el sustituto, relacionados |
| 21 | Agregar un ejercicio que no estaba | 3 | Se anota como realizado y se ve que no era del plan |
| 22 | Saltear un ejercicio planificado | 3 | «No realizado», sin juicio; la sesión termina igual |
| 23 | Sesión idéntica al plan frente a una distinta | 3 | «Realizada» sin marca; con diferencias, «Modificada» y en qué difiere |
| 24 | Más o menos repeticiones o peso que el objetivo | 3 | No marca «Modificada» |
| 25 | Editar o eliminar la rutina después de la sesión | 3 | Plan y realizado de la sesión no cambian |
| 26 | Sesión vacía | 3 | «Sin planificación» |
| 27 | Cambiar el tipo de medición de un ejercicio usado en una rutina | 2 y 3 | Aviso de revisar objetivos; al copiar al plan queda «objetivos no copiados» |
| 28 | Planificar un día con una rutina; cambiarla; quitarla | 4 | Una sola sesión planificada, sin tocar otros días |
| 29 | «Hoy»: elegir una rutina y empezar sin planificar | 4 | Sesión en curso |
| 30 | La misma rutina en varios días | 4 | Sesiones independientes; la app no repite ni propone fechas |
| 31 | Reprogramar una sesión planificada (dos veces) | 4 | Siempre la misma sesión, «Reprogramada» y su recorrido de fechas |
| 32 | Mover una sesión realizada o en curso; mover a una fecha pasada | 4 | No se permite |
| 33 | Cancelar y volver a planificar | 4 | «Cancelada» con el plan conservado; se puede volver a planificar |
| 34 | Una planificada que pasó sin hacerse | 4 | «Sin registrar» y las opciones registrar, reprogramar o cancelar |
| 35 | Doble clic o reintento al planificar, mover o cancelar | 4 | Sin duplicados ni doble aplicación |
| 36 | Calendario del mes y un día con dos sesiones | 4 | Estados y marcas por día; detalle de ambas en orden |
| 37 | Historia de un ejercicio con tres sesiones | 5 | De la más reciente a la más antigua, con series y esfuerzo |
| 38 | «La última vez» dentro de una sesión en curso | 5 | En un paso, sin salir |
| 39 | Historia vacía; ejercicio renombrado después; ejercicio eliminado | 5 | «Todavía no lo registraste»; cada entrada con el nombre de ese día; las sesiones siguen visibles |
| 40 | Corregir una sesión realizada | 6 | Se guarda, «Corregida»; el nombre y el tipo de medición no cambian |
| 41 | Eliminar una sesión | 6 | Desaparece del calendario y de la historia; rutinas y catálogo intactos |
| 42 | Editar o eliminar un ejercicio propio, o repetir la importación | todas | Ninguna sesión ya creada cambia |
| 43 | Recargar con una sesión en curso; cerrar sesión | 1 | Se recupera lo escrito; cerrar sesión borra el borrador |
| 44 | Cortar la red durante una sesión en curso | 1 | «Sin guardar en el servidor»; nada se muestra como guardado; al volver, se guarda |
| 45 | Guardar la misma sesión desde dos pestañas | 1 | La segunda recibe «cambió en otro dispositivo» y elige qué conservar |
| 46 | La cuenta B y la petición anónima | todas | No ven ni cambian rutinas ni sesiones de A |
| 47 | Teléfono y escritorio, teclado y lector de pantalla; revisión de textos | todas | Sin desplazamiento horizontal; axe sin problemas graves; sin rachas ni culpa |
| 48 | Un mes con 200 sesiones y un ejercicio con 500 | 4 y 5 | Calendario en menos de 2 s; primera tanda de la historia en menos de 1 s |

## Criterio de terminado

Todos los comandos de verificación pasan y los 48 escenarios se cumplen. Además, la verificación incluye la revisión de seguridad dirigida (RLS, funciones, instantáneas, ausencia de contenido en registros) y la medición de rendimiento con datos sintéticos, registradas en `verification.md`.
