# (Opcional) Instalar las skills de fitness

Al principio pediste instalar las skills `fitness-coach`, `fitness-nutrition` y `fitness-analyzer`. La instalación con `npx skills use …` quedó bloqueada por los permisos de seguridad de Claude Code, porque ejecuta código descargado de terceros, y no la forcé.

Las skills propias del proyecto ya están instaladas en `.claude/skills/` (`nutrition-domain-rules`, `database-design`, `frontend-design`, `test-driven-development`, `systematic-debugging`). Para lo que viene (registro de comidas, objetivos, entrenamiento) las de fitness pueden aportar criterio de dominio, pero **no son necesarias**.

## Si querés instalarlas

1. Revisar primero qué hace cada una en su repositorio (son instrucciones de terceros que Claude va a seguir).
2. Ejecutarlas vos mismo desde Claude Code con el prefijo `!`, una por una, por ejemplo:
   ```text
   ! npx skills use <ruta-de-la-skill>
   ```
   (Las rutas exactas están en tu mensaje original de la primera sesión.)
3. Avisarme. Al cargarlas reviso que no contradigan la Constitution, en particular el Principio IV: sin lenguaje culpabilizante ni recomendaciones coercitivas.

## Listo cuando

- [ ] Instaladas y revisadas, o descartadas.
