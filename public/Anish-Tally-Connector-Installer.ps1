param([string]$BridgeToken="")
$ErrorActionPreference="Stop"

$InstallDir="C:\ProgramData\AnishTallyConnector"
$BridgeUrl="https://tally-bridge.anish-tech.online"
$BridgeScriptUrl="https://raw.githubusercontent.com/anishhfgpl-uk/portal/main/public/tally-bridge.cjs"
$Bridge=Join-Path $InstallDir "tally-bridge.cjs"
$EnvFile=Join-Path $InstallDir ".env"
$TaskName="Anish Tally Connector"

Write-Host "=== Anish Tally Connector installer ===" -ForegroundColor Cyan

if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  throw "Run PowerShell as Administrator."
}

$node=Get-Command node -ErrorAction SilentlyContinue
if(-not $node){ throw "Node.js is not installed. Install Node.js LTS and run this installer again." }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

if([string]::IsNullOrWhiteSpace($BridgeToken)){
  $BridgeToken=Read-Host "Enter the SAME TALLY_BRIDGE_TOKEN configured on the hosted portal"
}
if([string]::IsNullOrWhiteSpace($BridgeToken)){ throw "Bridge token is required." }

Invoke-WebRequest -UseBasicParsing $BridgeScriptUrl -OutFile $Bridge

$envText=@"
BRIDGE_HOST=127.0.0.1
BRIDGE_PORT=8787
TALLY_URL=http://127.0.0.1:9000
BRIDGE_TOKEN=$BridgeToken
ALLOW_ORIGIN=https://anish-tech.online
"@
Set-Content -Path $EnvFile -Value $envText -Encoding UTF8

# Reuse the existing office Cloudflare Tunnel service. This installer does NOT
# create a new tunnel, change DNS, or require another Cloudflare login.

schtasks.exe /Delete /TN "$TaskName" /F 2>$null | Out-Null

$action=New-ScheduledTaskAction -Execute $node.Source -Argument ('"' + $Bridge + '"') -WorkingDirectory $InstallDir
$trigger=New-ScheduledTaskTrigger -AtStartup
$principal=New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

try{
  $local=Invoke-RestMethod "http://127.0.0.1:8787/health" -TimeoutSec 5
  Write-Host "LOCAL BRIDGE: OK" -ForegroundColor Green
  Write-Host ("Authentication: "+$local.auth)
  Write-Host ("Tally: "+$local.tallyUrl)
}catch{
  Write-Host "LOCAL BRIDGE CHECK FAILED" -ForegroundColor Red
  Write-Host $_.Exception.Message
}

try{
  $remote=Invoke-RestMethod "$BridgeUrl/health" -TimeoutSec 10
  Write-Host "CLOUDFLARE BRIDGE: OK" -ForegroundColor Green
  Write-Host ("Service: "+$remote.service)
}catch{
  Write-Host "CLOUDFLARE BRIDGE CHECK FAILED" -ForegroundColor Yellow
  Write-Host "Verify the existing Cloudflare Tunnel routes $BridgeUrl to http://127.0.0.1:8787."
}

Write-Host ""
Write-Host "INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "Bridge: $BridgeUrl"
Write-Host "Local folder: $InstallDir"
Write-Host "Task: $TaskName"
Write-Host ""
Write-Host "Next: set the same token in the hosted portal as TALLY_BRIDGE_TOKEN, then use Test Connection."
