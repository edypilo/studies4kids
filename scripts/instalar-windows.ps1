# Instala (o actualiza) Studies4Kids en un PC con Windows 10/11 y lo deja arrancando solo al encender.
# No lo ejecutes directamente: haz doble clic en instalar.cmd, que lo lanza como administrador.
# Se puede volver a ejecutar las veces que haga falta: sirve tambien para actualizar la app.
#Requires -RunAsAdministrator
param(
    [int]$Puerto = 3000
)

$ErrorActionPreference = 'Stop'
$proyecto = Split-Path -Parent $PSScriptRoot
$tarea = 'Studies4Kids'
Set-Location $proyecto

function Paso($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "   OK: $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   AVISO: $texto" -ForegroundColor Yellow }
function Preguntar($texto) { (Read-Host "$texto (S/N)") -match '^[sS]' }
function Fallar($texto) {
    Write-Host "`nERROR: $texto" -ForegroundColor Red
    Read-Host 'Pulsa Intro para cerrar'
    exit 1
}

Write-Host 'Instalacion de Studies4Kids' -ForegroundColor White
Write-Host "Carpeta: $proyecto"

# ---------------------------------------------------------------- Comprobaciones previas
Paso 'Comprobando el equipo'
if (-not (Test-Path (Join-Path $proyecto 'package.json'))) { Fallar 'No encuentro package.json. Ejecuta instalar.cmd desde la carpeta de la app.' }

# La app y la sesion de ChatGPT pertenecen a un usuario de Windows concreto. Si se elevo con OTRA cuenta de
# administrador, todo quedaria instalado para esa otra cuenta y no funcionaria.
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$enPantalla = (Get-CimInstance Win32_ComputerSystem).UserName
if ($enPantalla -and ($enPantalla -ne $usuario)) {
    Fallar "Estas ejecutando esto como '$usuario', pero la sesion abierta es de '$enPantalla'. Inicia sesion en Windows con una cuenta de administrador y vuelve a ejecutarlo desde ella."
}
Bien "Usuario: $usuario"

# ---------------------------------------------------------------- Parar la app si ya estaba
$existente = Get-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
if ($existente) {
    Paso 'Parando la app para actualizarla'
    Stop-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue
}
$ocupado = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
foreach ($id in ($ocupado.OwningProcess | Select-Object -Unique)) {
    $proceso = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($proceso -and $proceso.ProcessName -eq 'node') {
        Stop-Process -Id $id -Force
        Bien 'App anterior detenida'
    } elseif ($proceso) {
        Fallar "El puerto $Puerto lo esta usando otro programa ($($proceso.ProcessName)). Cierralo o instala con otro puerto: instalar.cmd -Puerto 8080"
    }
}

# ---------------------------------------------------------------- Node.js
Paso 'Node.js'
$env:Path = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$env:Path"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Fallar 'Falta Node.js y este equipo no tiene winget. Instala Node.js LTS desde https://nodejs.org y vuelve a ejecutar esto.'
    }
    Write-Host '   Instalando Node.js LTS (puede tardar unos minutos)...'
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
    if (-not (Test-Path "$env:ProgramFiles\nodejs\node.exe")) { Fallar 'No se pudo instalar Node.js.' }
}
$version = (node -v)
if ([int]($version -replace '^v(\d+).*', '$1') -lt 24) { Fallar "Node.js $version es demasiado antiguo: hace falta la version 24 o posterior. Actualizalo desde https://nodejs.org" }
Bien "Node.js $version"

# ---------------------------------------------------------------- Codex (conexion con ChatGPT)
Paso 'Codex CLI (la conexion con la cuenta de ChatGPT)'
$codexJs = Join-Path $env:APPDATA 'npm\node_modules\@openai\codex\bin\codex.js'
if (-not (Test-Path $codexJs)) {
    Write-Host '   Instalando Codex...'
    cmd.exe /d /c 'npm install -g @openai/codex'
    if (-not (Test-Path $codexJs)) { Fallar 'No se pudo instalar Codex.' }
}
Bien (cmd.exe /d /c 'codex --version')

# ---------------------------------------------------------------- Dependencias y compilacion
Paso 'Instalando las piezas de la app (varios minutos la primera vez)'
cmd.exe /d /c 'npm ci'
if ($LASTEXITCODE -ne 0) { Fallar 'Fallo "npm ci". Revisa la conexion a internet y vuelve a intentarlo.' }
Bien 'Dependencias instaladas'

Paso 'Compilando la app'
$env:NEXT_TELEMETRY_DISABLED = '1'
cmd.exe /d /c 'npm run build'
if ($LASTEXITCODE -ne 0) { Fallar 'Fallo la compilacion.' }
Bien 'App compilada'

# ---------------------------------------------------------------- Datos
Paso 'Datos'
$datos = Join-Path $proyecto 'data'
if (Test-Path (Join-Path $datos 'studies4kids.db')) {
    Bien 'Se han encontrado datos existentes: se conservan.'
} else {
    Bien 'Instalacion nueva: al abrir la app te pedira el PIN de padres y los perfiles de tus hijos.'
    Aviso 'Si lo que querias era traer los datos de otro PC, copia su carpeta "data" aqui y vuelve a ejecutar esto.'
}

# ---------------------------------------------------------------- Red y cortafuegos
Paso 'Red de casa y cortafuegos'
$redes = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' }
foreach ($red in $redes) {
    if ($red.NetworkCategory -eq 'Public') {
        Aviso "La red '$($red.Name)' esta marcada como Publica: Windows bloquea las conexiones desde otros dispositivos."
        if (Preguntar "   Marcarla como Privada? Hazlo solo si es la red de tu casa") {
            Set-NetConnectionProfile -InterfaceIndex $red.InterfaceIndex -NetworkCategory Private
            Bien 'Red marcada como Privada'
        } else {
            Aviso 'Se deja como Publica: los demas dispositivos NO podran abrir la app.'
        }
    }
}
Get-NetFirewallRule -DisplayName $tarea -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $tarea -Description 'App de estudio de la familia' -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Puerto -Profile Private | Out-Null
Bien "Cortafuegos: permitido el puerto $Puerto solo en redes privadas"

# ---------------------------------------------------------------- Que no se duerma
Paso 'Suspension del equipo'
if (Preguntar '   Evitar que el equipo se suspenda solo estando enchufado? Recomendado para que la app este siempre disponible') {
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    Bien 'El equipo ya no se suspendera solo (la pantalla si puede apagarse)'
}

# ---------------------------------------------------------------- Arranque automatico
Paso 'Arranque automatico al encender'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $proyecto `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$proyecto\scripts\iniciar.ps1`" -Puerto $Puerto"
$disparador = New-ScheduledTaskTrigger -AtStartup
# S4U: la tarea corre con tu usuario aunque nadie haya iniciado sesion, sin guardar tu contrasena.
$quien = New-ScheduledTaskPrincipal -UserId $usuario -LogonType S4U -RunLevel Limited
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $tarea -Description 'Studies4Kids: app de estudio de la familia' -Force `
    -Action $accion -Trigger $disparador -Principal $quien -Settings $ajustes | Out-Null
Bien "Tarea programada '$tarea' creada"

# ---------------------------------------------------------------- Arrancar y comprobar
Paso 'Arrancando la app'
Start-ScheduledTask -TaskName $tarea
$funciona = $false
foreach ($intento in 1..30) {
    Start-Sleep -Seconds 2
    try {
        $respuesta = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:$Puerto/"
        if ($respuesta.StatusCode -eq 200) { $funciona = $true; break }
    } catch { }
}
if ($funciona) {
    Bien 'La app responde'
} else {
    Aviso 'La app no ha respondido en un minuto. Mira el registro: data\logs\app.log'
    Aviso 'Si el registro esta vacio, abre el Programador de tareas, busca "Studies4Kids" y mira el resultado de la ultima ejecucion.'
}

# ---------------------------------------------------------------- Sesion de ChatGPT
Paso 'Sesion de ChatGPT'
cmd.exe /d /c 'codex login status' | Out-Null
if ($LASTEXITCODE -eq 0) {
    Bien 'Codex ya tiene la sesion de ChatGPT iniciada'
} else {
    Aviso 'Codex no tiene sesion. Se va a abrir el navegador para que inicies sesion con tu cuenta de ChatGPT.'
    Read-Host '   Pulsa Intro para continuar'
    cmd.exe /d /c 'codex login'
    cmd.exe /d /c 'codex login status' | Out-Null
    if ($LASTEXITCODE -eq 0) { Bien 'Sesion iniciada' } else { Aviso 'No se ha iniciado sesion. Puedes hacerlo despues abriendo una terminal y ejecutando: codex login' }
}

# ---------------------------------------------------------------- Resumen
Write-Host "`n================================================================" -ForegroundColor White
if ($funciona) { Write-Host ' Studies4Kids esta instalada y en marcha.' -ForegroundColor Green } else { Write-Host ' Instalacion terminada, pero la app no responde todavia.' -ForegroundColor Yellow }
Write-Host ' Direcciones para abrirla desde los dispositivos de casa:'
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
foreach ($ip in $ips) { Write-Host "    http://$($ip.IPAddress):$Puerto" -ForegroundColor White }
Write-Host ' Reserva esa IP en el router para que no cambie.'
Write-Host ' Ultimo paso: abre la app. Si es una instalacion nueva, crea el PIN de padres y los'
Write-Host ' perfiles de tus hijos. Despues, en el panel de padres, pulsa "Probar conexion".'
Write-Host '================================================================' -ForegroundColor White
Read-Host 'Pulsa Intro para cerrar'
