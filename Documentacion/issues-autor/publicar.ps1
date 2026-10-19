# Publica cada Documentacion/issues-autor/NN-*.md como un issue de GitHub.
# Requisitos: GitHub CLI instalada (winget install GitHub.cli), `gh auth login` hecho y el repositorio subido.
$ErrorActionPreference = 'Stop'
$folder = Split-Path -Parent $MyInvocation.MyCommand.Path

gh label create 'tarea del autor' --color 'D4A72C' --description 'Requiere una accion del autor (cuentas, claves, decisiones)' --force | Out-Null

Get-ChildItem -Path $folder -Filter '[0-9][0-9]-*.md' | Sort-Object Name | ForEach-Object {
    $lines = Get-Content -Path $_.FullName -Encoding UTF8
    $title = ($lines[0] -replace '^#\s*', '').Trim()
    $body = ($lines | Select-Object -Skip 1) -join "`n"
    $bodyFile = New-TemporaryFile
    Set-Content -Path $bodyFile -Value $body.Trim() -Encoding UTF8
    gh issue create --title $title --body-file $bodyFile --label 'tarea del autor'
    Remove-Item $bodyFile
}
