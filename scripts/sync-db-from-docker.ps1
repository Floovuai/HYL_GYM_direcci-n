$ErrorActionPreference = "Stop"

$container = "dashcom"
$dataDir = Join-Path (Get-Location) "data"
$target = Join-Path $dataDir "hyl_gym.db"
$temp = Join-Path $dataDir "hyl_gym.from-docker-latest.db"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $dataDir "hyl_gym.before-docker-sync-$stamp.db"

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

docker inspect $container | Out-Null
@'
import Database from "better-sqlite3";
const db = new Database("/app/data/hyl_gym.db");
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
'@ | docker exec -i $container node --input-type=module

docker cp "${container}:/app/data/hyl_gym.db" $temp

if (Test-Path -LiteralPath $target) {
  Copy-Item -LiteralPath $target -Destination $backup -Force
}

try {
  foreach ($sidecar in @("$target-wal", "$target-shm")) {
    if (Test-Path -LiteralPath $sidecar) {
      Remove-Item -LiteralPath $sidecar -Force
    }
  }
  Copy-Item -LiteralPath $temp -Destination $target -Force
} catch {
  Write-Error "No se pudo reemplazar data\hyl_gym.db. Cierra npm run dev u otro proceso local que este usando SQLite y vuelve a ejecutar este comando."
}

Write-Output "Base sincronizada desde Docker a data\hyl_gym.db"
if (Test-Path -LiteralPath $backup) {
  Write-Output "Backup local: $backup"
}
