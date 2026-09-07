param(
  [ValidateSet("pre-update", "post-update", "manual")]
  [string]$Mode = "manual"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $root "backups\platform\$stamp-$Mode"
$sourceZip = Join-Path $backupRoot "platform-source-$stamp.zip"
$manifest = Join-Path $backupRoot "MANIFEST.txt"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

function Write-ManifestLine {
  param([string]$Text)
  Add-Content -LiteralPath $manifest -Value $Text
}

Write-ManifestLine "DashCom plataforma backup"
Write-ManifestLine "Modo: $Mode"
Write-ManifestLine "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Write-ManifestLine "Ruta: $backupRoot"
Write-ManifestLine ""

$localDb = Join-Path $root "data\hyl_gym.db"
if (Test-Path -LiteralPath $localDb) {
  Copy-Item -LiteralPath $localDb -Destination (Join-Path $backupRoot "hyl_gym.local.db") -Force
  Write-ManifestLine "Base local: hyl_gym.local.db"
} else {
  Write-ManifestLine "Base local: no encontrada en data\hyl_gym.db"
}

$dockerRunning = $false
try {
  $dockerStatus = docker ps --filter "name=dashcom" --format "{{.Names}}|{{.Status}}"
  if ($dockerStatus -match "^dashcom\|") {
    $dockerRunning = $true
    docker cp "dashcom:/app/data/hyl_gym.db" (Join-Path $backupRoot "hyl_gym.docker.db") | Out-Null
    Write-ManifestLine "Base Docker: hyl_gym.docker.db"
  } else {
    Write-ManifestLine "Base Docker: contenedor dashcom no activo"
  }
} catch {
  Write-ManifestLine "Base Docker: no se pudo copiar ($($_.Exception.Message))"
}

$uploads = Join-Path $root "uploads"
if (Test-Path -LiteralPath $uploads) {
  Compress-Archive -LiteralPath $uploads -DestinationPath (Join-Path $backupRoot "uploads-$stamp.zip") -Force
  Write-ManifestLine "Uploads: uploads-$stamp.zip"
} else {
  Write-ManifestLine "Uploads: carpeta no encontrada"
}

$sourcePaths = @(
  ".github",
  "docs",
  "scripts",
  "src",
  "tests",
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "docker-compose.yml",
  "Dockerfile",
  "index.html",
  "INICIAR_DASHCOM.bat",
  "package-lock.json",
  "package.json",
  "README.md",
  "tsconfig.json",
  "vite.config.ts"
) | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path -LiteralPath $_ }

if ($sourcePaths.Count -gt 0) {
  Compress-Archive -LiteralPath $sourcePaths -DestinationPath $sourceZip -Force
  Write-ManifestLine "Codigo/config no secreta: platform-source-$stamp.zip"
}

try {
  Write-ManifestLine ""
  Write-ManifestLine "Git status:"
  git -C $root status --short | ForEach-Object { Write-ManifestLine $_ }
} catch {
  Write-ManifestLine "Git status: no disponible ($($_.Exception.Message))"
}

try {
  Write-ManifestLine ""
  Write-ManifestLine "Docker:"
  docker ps --filter "name=dashcom" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | ForEach-Object { Write-ManifestLine $_ }
} catch {
  Write-ManifestLine "Docker: no disponible ($($_.Exception.Message))"
}

$finalZip = Join-Path (Split-Path $backupRoot -Parent) "$stamp-$Mode.zip"
Compress-Archive -LiteralPath $backupRoot -DestinationPath $finalZip -Force

Write-Output "Backup creado: $finalZip"
Write-Output "Carpeta staging: $backupRoot"
if ($dockerRunning) {
  Write-Output "Incluye base Docker activa."
}
