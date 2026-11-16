# Read-only: identify the process on port 3000; does not terminate it.
$rows = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $rows) { Write-Host 'Nothing is listening on port 3000.'; exit 0 }
foreach ($pidValue in ($rows | Select-Object -ExpandProperty OwningProcess -Unique)) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"
  [pscustomobject]@{ PID=$pidValue; Name=$p.Name; CommandLine=$p.CommandLine } | Format-List
}
Write-Host 'Port 3000 is already in use. If this is an old JoyJourney node.exe process, stop it from its own terminal with Ctrl+C.'
exit 1
