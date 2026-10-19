# Subir el repositorio a GitHub y publicar los issues del autor

**Por qué:** el repositorio de GitHub (`SOrtiz1967/myguide`) está vacío. Todo el trabajo (specs 001 y 002, unas 30 confirmaciones) existe solo en esta computadora: si el disco falla, se pierde. Además, sin el repositorio subido no se pueden crear los issues.

**Tiempo estimado:** 10 minutos.

## Pasos

1. Instalar la CLI de GitHub (una sola vez), en PowerShell:
   ```powershell
   winget install GitHub.cli
   ```
   Cerrar y volver a abrir la terminal.
2. Iniciar sesión (abre el navegador):
   ```powershell
   gh auth login
   ```
   Elegir: GitHub.com → HTTPS → "Login with a web browser".
3. Subir las ramas, desde la carpeta del proyecto:
   ```powershell
   git push -u origin main
   git push origin 001-cuentas-perfil-pwa 002-catalogo-de-alimentos
   ```
4. Publicar estos issues:
   ```powershell
   powershell -ExecutionPolicy Bypass -File Documentacion\issues-autor\publicar.ps1
   ```

## Antes de subir: comprobar que no se suba ningún secreto

```powershell
npm run check:secrets --prefix app
git status --ignored --short | Select-String "\.env"
```

El primer comando debe decir "Sin secretos en el bundle ni en el repositorio". El segundo debe mostrar `supabase/.env`, `supabase/.env.local` y `app/.env.local` como **ignorados** (`!!`): no se suben.

## Listo cuando

- [ ] `https://github.com/SOrtiz1967/myguide` muestra el código en `main`.
- [ ] Los issues 02 a 07 aparecen con la etiqueta `tarea del autor`.
- [ ] (Recomendado) El repositorio es **privado**: Settings → General → Danger Zone → Change visibility.
