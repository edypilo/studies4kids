# Arranca Studies4Kids. Lo ejecuta la tarea programada "Studies4Kids" al encender el equipo.
# Tambien se puede lanzar a mano para probar:  powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
param(
    [int]$Puerto = 3000
)

$ErrorActionPreference = 'Stop'
$proyecto = Split-Path -Parent $PSScriptRoot
Set-Location $proyecto

# Node y Codex pueden no estar en el PATH de una tarea programada: se anaden sus carpetas habituales.
$env:Path = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$env:Path"
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:NODE_ENV = 'production'

$datos = if ($env:DATA_DIR) { $env:DATA_DIR } else { Join-Path $proyecto 'data' }
$registros = Join-Path $datos 'logs'
New-Item -ItemType Directory -Force $registros | Out-Null
$registro = Join-Path $registros 'app.log'

# El registro no crece sin limite: al pasar de 5 MB se guarda como app.anterior.log y se empieza otro.
if ((Test-Path $registro) -and ((Get-Item $registro).Length -gt 5MB)) {
    Move-Item -Force $registro (Join-Path $registros 'app.anterior.log')
}

"`n===== Arranque: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (puerto $Puerto) =====" | Out-File -Append -Encoding utf8 $registro

if (-not (Test-Path (Join-Path $proyecto '.next\BUILD_ID'))) {
    'ERROR: la app no esta compilada. Ejecuta instalar.cmd.' | Out-File -Append -Encoding utf8 $registro
    exit 1
}

# cmd se encarga de volcar la salida al registro sin que PowerShell la convierta en errores.
$orden = "node node_modules\next\dist\bin\next start -H 0.0.0.0 -p $Puerto >> `"$registro`" 2>&1"
cmd.exe /d /c $orden
exit $LASTEXITCODE
