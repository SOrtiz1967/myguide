# Cargar el catálogo de alimentos en producción

**Spec 002, tarea T077.** Requiere el despliegue (issue 04). Idealmente también el issue 02, para cargar los genéricos de USDA en el mismo paso.

**Tiempo estimado:** 20 minutos (la carga de Open Food Facts por la API tarda varios minutos por el ritmo cortés).

## 1. Completar `supabase/.env` (en tu computadora, no se sube a Git)

Al final del archivo hay tres variables nuevas, vacías:

```text
SUPABASE_URL=                 # Project Settings → API → Project URL (https://xxxx.supabase.co)
SUPABASE_SERVICE_ROLE_KEY=    # Project Settings → API Keys → service_role (o la clave "secret")
OFF_USER_AGENT=               # por ejemplo: MyGuide/0.1 (tu-correo@ejemplo.com)
```

> ⚠️ La clave `service_role` da acceso total a la base. No la pegues en el chat, en `app/` ni en ningún archivo que se suba a Git. Si se filtra, se rota desde el panel de Supabase.

Si `supabase/.env` no tiene esas líneas, copialas de `supabase/.env.example`.

## 2. Simular primero, después cargar

```powershell
npm run import:off:prod -- --dry-run      # valida y cuenta, sin escribir
npm run import:off:prod                    # Open Food Facts (Argentina)
npm run import:usda:prod                   # solo si ya se hizo el issue 02
```

Cada carga muestra al final cuántos alimentos se crearon, actualizaron y omitieron, con el motivo. El informe también queda en `supabase/import/out/informe-<fuente>.json`.

## 3. Verificar en la app publicada

- [ ] `/fuentes` muestra Open Food Facts con su licencia (ODbL 1.0), el texto de atribución, la fecha de importación y la cantidad de alimentos.
- [ ] Buscar "leche" o "galletitas" devuelve productos del catálogo.
- [ ] Avisarme los números del informe para registrarlos y cerrar T077 de la spec 002.
