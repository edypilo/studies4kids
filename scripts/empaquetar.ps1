# Prepara un .zip de Studies4Kids para pasarselo a otra familia.
# El zip lleva solo el programa: NO incluye la carpeta "data" (perfiles, PIN, material y notas de tus hijos)
# ni la sesion de ChatGPT. Quien lo instale empieza de cero con su propia familia y su propia cuenta.
# Uso: doble clic en empaquetar.cmd. El resultado queda en la carpeta "compartir".
$ErrorActionPreference = 'Stop'
$proyecto = Split-Path -Parent $PSScriptRoot
$salida = Join-Path $proyecto 'compartir'
$zip = Join-Path $salida 'Studies4Kids.zip'
$temporal = Join-Path ([IO.Path]::GetTempPath()) ("s4k-zip-" + [Guid]::NewGuid().ToString('N'))
$copia = Join-Path $temporal 'Studies4Kids'

# Carpetas que nunca se comparten: datos de la familia, piezas que el instalador vuelve a crear y ajustes locales.
$carpetasFuera = @('data', 'node_modules', '.next', '.claude', '.git', 'compartir')
$archivosFuera = @('*.log', '*.tsbuildinfo', '.env', '.env.*')

try {
    New-Item -ItemType Directory -Force $copia | Out-Null
    $excluidas = $carpetasFuera | ForEach-Object { Join-Path $proyecto $_ }
    robocopy $proyecto $copia /E /XD $excluidas /XF $archivosFuera /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos (robocopy $LASTEXITCODE)." }

    # Comprobacion de seguridad: si por lo que sea se hubiera colado una base de datos, no se genera el zip.
    $colados = Get-ChildItem $copia -Recurse -Force -File | Where-Object { $_.Name -like '*.db' -or $_.Name -like '*.db-*' }
    if ($colados) { throw "Se han encontrado bases de datos en la copia: $($colados.FullName -join ', '). No se genera el zip." }
    foreach ($necesario in @('package.json', 'package-lock.json', 'instalar.cmd', 'INSTALAR.md', 'scripts\instalar-windows.ps1', 'scripts\iniciar.ps1', 'src')) {
        if (-not (Test-Path (Join-Path $copia $necesario))) { throw "Falta $necesario en la copia." }
    }

    New-Item -ItemType Directory -Force $salida | Out-Null
    if (Test-Path $zip) { Remove-Item -Force $zip }
    Compress-Archive -Path $copia -DestinationPath $zip
    $tamano = [math]::Round((Get-Item $zip).Length / 1KB)
    Write-Host "Listo: $zip ($tamano KB)" -ForegroundColor Green
    Write-Host 'No incluye vuestros datos ni la sesion de ChatGPT.'
    Write-Host 'Quien lo reciba debe descomprimirlo y seguir INSTALAR.md.'
} finally {
    Remove-Item -Recurse -Force $temporal -ErrorAction SilentlyContinue
}
