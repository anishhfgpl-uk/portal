param([string]$BridgeToken="")
$ErrorActionPreference="Stop"

$InstallDir="C:\ProgramData\AnishTallyConnector"
$BridgeUrl="https://tally-bridge.anish-tech.online"
$BridgeScriptUrl="https://raw.githubusercontent.com/anishhfgpl-uk/portal/main/public/tally-bridge.cjs"
$Bridge=Join-Path $InstallDir "tally-bridge.cjs"
$EnvFile=Join-Path $InstallDir ".env"
$TaskName="Anish Portal Tally Connector"
$Launcher=Join-Path $InstallDir "start-connector.ps1"

Write-Host "=== ANISH TECHNOLOGIES - PORTAL TALLY CONNECTOR v3 ===" -ForegroundColor Cyan

if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  throw "Run PowerShell as Administrator."
}

$BundledNode=Join-Path $InstallDir "node\node.exe"
if(Test-Path $BundledNode){
  $node=Get-Item $BundledNode
}else{
  $node=Get-Command node -ErrorAction SilentlyContinue
}
if(-not $node){ throw "Node.js runtime not found in $InstallDir or PATH." }

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

cmd.exe /c "schtasks.exe /Delete /TN ""Anish Tally Connector"" /F >nul 2>&1"
if($LASTEXITCODE -ne 0){ Write-Host "No previous connector task found; continuing." -ForegroundColor DarkGray }

$nodePath = if($node.PSObject.Properties.Name -contains "Source"){ $node.Source } else { $node.FullName }
$action=New-ScheduledTaskAction -Execute $nodePath -Argument "`"$Bridge`"" -WorkingDirectory $InstallDir
$trigger=New-ScheduledTaskTrigger -AtStartup
$principal=New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

# Create a resilient hidden launcher used by the Portal Start Connector button.
# It starts the scheduled task whenever the bridge is not already healthy and retries once.
$launcherText=@'
$ErrorActionPreference="SilentlyContinue"
$task="Anish Portal Tally Connector"
function Test-Bridge {
  try { $h=Invoke-RestMethod "http://127.0.0.1:8787/health" -TimeoutSec 3; return [bool]$h.ok } catch { return $false }
}
if(Test-Bridge){ exit 0 }
& schtasks.exe /Run /TN $task | Out-Null
for($i=0;$i -lt 8;$i++){
  Start-Sleep -Seconds 1
  if(Test-Bridge){ exit 0 }
}
& schtasks.exe /Run /TN $task | Out-Null
for($i=0;$i -lt 8;$i++){
  Start-Sleep -Seconds 1
  if(Test-Bridge){ exit 0 }
}
exit 1
'@
Set-Content -Path $Launcher -Value $launcherText -Encoding UTF8

# Register a website button protocol so the Portal can start the connector manually.
$protocolRoot = "HKLM:\Software\Classes\anish-tally"
New-Item -Path "$protocolRoot\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $protocolRoot -Name "(Default)" -Value "URL:Anish Tally Connector"
Set-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value ""
$protocolCommand = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$Launcher+'"'
Set-ItemProperty -Path "$protocolRoot\shell\open\command" -Name "(Default)" -Value $protocolCommand
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
Write-Host "PORTAL TALLY CONNECTOR INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "Bridge: $BridgeUrl"
Write-Host "Local folder: $InstallDir"
Write-Host "Task: $TaskName"
Write-Host ""
Write-Host "Portal Start Connector button uses anish-tally://start and starts this task silently."
