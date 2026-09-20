param(
  [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath("Desktop")) "Dashcom Desktop")
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$stagingRoot = Join-Path $projectRoot "desktop-build"
$seedRoot = Join-Path $stagingRoot "seed"
$seedUploads = Join-Path $seedRoot "uploads"
$runtimeEnv = Join-Path $stagingRoot "runtime.env"
$seedDatabase = Join-Path $seedRoot "hyl_gym.db"

New-Item -ItemType Directory -Force -Path $seedUploads | Out-Null
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$resolvedStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)
$resolvedSeedUploads = [System.IO.Path]::GetFullPath($seedUploads)
if (-not $resolvedSeedUploads.StartsWith($resolvedStagingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "La carpeta temporal de uploads quedo fuera del staging esperado."
}

$dockerContainer = $null
try { $dockerContainer = docker ps --filter "name=^/dashcom$" --format "{{.Names}}" 2>$null } catch { $dockerContainer = $null }
if ($dockerContainer -eq "dashcom") {
  Write-Output "Preparando una copia consistente de la base Docker..."
  @'
import Database from "better-sqlite3";
const db = new Database("/app/data/hyl_gym.db");
const result = db.pragma("quick_check");
if (result.some((row) => row.quick_check !== "ok")) process.exit(2);
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
'@ | docker exec -i dashcom node --input-type=module
  if ($LASTEXITCODE -ne 0) { throw "La verificacion de la base Docker fallo." }
  docker cp "dashcom:/app/data/hyl_gym.db" $seedDatabase
  if ($LASTEXITCODE -ne 0) { throw "No se pudo copiar la base desde Docker." }
  Get-ChildItem -LiteralPath $resolvedSeedUploads -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  docker cp "dashcom:/app/uploads/." $seedUploads
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron copiar los archivos cargados desde Docker." }
} else {
  $localDatabase = Join-Path $projectRoot "data\hyl_gym.db"
  if (-not (Test-Path -LiteralPath $localDatabase)) {
    throw "No se encontro el contenedor dashcom ni una base local para incluir."
  }
  Copy-Item -LiteralPath $localDatabase -Destination $seedDatabase -Force
  $localUploads = Join-Path $projectRoot "uploads"
  if (Test-Path -LiteralPath $localUploads) {
    Copy-Item -Path (Join-Path $localUploads "*") -Destination $seedUploads -Recurse -Force
  }
}

$allowedKeys = @(
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "AUTH_SESSION_SECRET",
  "AUTH_SESSION_TTL_MS",
  "CONSULTA_PUBLIC_URL",
  "EVO_BASE_URL",
  "EVO_DNS",
  "EVO_API_KEY",
  "EVO_SYNC_WORKER",
  "GROQ_API_KEY",
  "GROQ_MODEL"
)
$sourceEnv = Join-Path $projectRoot ".env"
if (Test-Path -LiteralPath $sourceEnv) {
  Get-Content -LiteralPath $sourceEnv |
    Where-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return $false }
      $key = $line.Split("=", 2)[0].Trim()
      return $allowedKeys -contains $key
    } |
    Set-Content -LiteralPath $runtimeEnv -Encoding UTF8
} else {
  Set-Content -LiteralPath $runtimeEnv -Value "EVO_SYNC_WORKER=0" -Encoding UTF8
}

Push-Location $projectRoot
try {
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Las pruebas automatizadas fallaron." }
  npm run desktop:build
  if ($LASTEXITCODE -ne 0) { throw "La compilacion del instalador fallo." }
} finally {
  Pop-Location
}

$appVersion = (Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json).version
$installer = Get-Item -LiteralPath (Join-Path $projectRoot "release\DashCom-Setup-$appVersion-x64.exe") -ErrorAction SilentlyContinue
if (-not $installer) {
  throw "La compilacion termino sin producir el instalador esperado."
}

$destination = Join-Path $OutputDirectory $installer.Name
Copy-Item -LiteralPath $installer.FullName -Destination $destination -Force

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$databaseStream = [System.IO.File]::OpenRead($seedDatabase)
try {
  $databaseHash = ([System.BitConverter]::ToString($sha256.ComputeHash($databaseStream))).Replace("-", "")
} finally {
  $databaseStream.Dispose()
  $sha256.Dispose()
}
$summary = @(
  "DashCom Desktop",
  "Instalador: $($installer.Name)",
  "Creado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
  "Base incluida: hyl_gym.db",
  "SHA256 base: $databaseHash",
  "Datos instalados en: %LOCALAPPDATA%\DashCom",
  "La desinstalacion conserva la base y los archivos del usuario.",
  "Al iniciar la nueva version, DashCom respalda la base existente antes de aplicar migraciones en %LOCALAPPDATA%\DashCom\backups.",
  "Para consultar desde otros equipos, conectalos a la misma red y permite DashCom en el firewall de Windows para redes privadas."
)
# Novedades: se toman de la seccion de esta version en CHANGELOG.md (sin texto fijo de versiones anteriores).
$changelog = Join-Path $projectRoot "CHANGELOG.md"
if (Test-Path -LiteralPath $changelog) {
  $inSection = $false
  foreach ($line in Get-Content -LiteralPath $changelog -Encoding UTF8) {
    if ($line -match '^## ') { $inSection = $line.StartsWith("## $appVersion "); continue }
    if ($inSection -and $line -match '^- (.+)$') {
      $summary += "Novedad $($appVersion): " + ($Matches[1] -replace '\*\*', '')
    }
  }
}
$summary | Set-Content -LiteralPath (Join-Path $OutputDirectory "LEEME.txt") -Encoding UTF8

Write-Output "Instalador creado: $destination"
