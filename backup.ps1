param(
  [string]$BackupDir = "$env:USERPROFILE\Google Drive\Backup Acordes"
)

$dbPath = Join-Path $PSScriptRoot "backend\dev.db"
$date = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupFile = Join-Path $BackupDir "acordes_backup_$date.db"

if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

try {
  Copy-Item -LiteralPath $dbPath -Destination $backupFile -Force
  Write-Host "OK: $backupFile ($([math]::Round((Get-Item $backupFile).Length / 1KB)) KB)"
} catch {
  Write-Host "ERRO: $_"
}
