param([string]$BridgeToken="",[string]$TunnelName="anish-tally",[string]$Hostname="tally-bridge.anish-tech.online")
$ErrorActionPreference="Stop"
$Base=Join-Path $env:ProgramData "AnishTallyConnector"; New-Item -ItemType Directory -Force -Path $Base | Out-Null
$NodeZip=Join-Path $Base "node.zip"; $NodeDir=Join-Path $Base "node"; $Cloudflared=Join-Path $Base "cloudflared.exe"; $Bridge=Join-Path $Base "tally-bridge.cjs"; $Config=Join-Path $Base "config.yml"; $EnvFile=Join-Path $Base ".env"
Write-Host "=== Anish Tally Connector installer ===" -ForegroundColor Cyan
if(-not $BridgeToken){$b=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $BridgeToken=([Convert]::ToBase64String($b)).TrimEnd("=" ).Replace("+","-").Replace("/","_")}
Invoke-WebRequest "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -OutFile $NodeZip
if(-not(Test-Path (Join-Path $NodeDir "node.exe"))){Expand-Archive -Force $NodeZip $Base; Rename-Item (Join-Path $Base "node-v22.14.0-win-x64") $NodeDir}
Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $Cloudflared
@("BRIDGE_HOST=127.0.0.1","BRIDGE_PORT=8787","TALLY_URL=http://127.0.0.1:9000","BRIDGE_TOKEN=$BridgeToken","ALLOW_ORIGIN=https://anish-tech.online") | Set-Content -Encoding UTF8 $EnvFile
Invoke-WebRequest "https://anish-tech.online/portal/tally-bridge.cjs" -OutFile $Bridge
Write-Host "Cloudflare login is required once in the office browser." -ForegroundColor Yellow
& $Cloudflared tunnel login; if($LASTEXITCODE -ne 0){throw "Cloudflare login failed."}
$list=& $Cloudflared tunnel list --output json 2>$null | ConvertFrom-Json; $found=$list | Where-Object {$_.name -eq $TunnelName}
if(-not $found){& $Cloudflared tunnel create $TunnelName; if($LASTEXITCODE -ne 0){throw "Could not create Cloudflare tunnel."}}
& $Cloudflared tunnel route dns $TunnelName $Hostname
$list=& $Cloudflared tunnel list --output json | ConvertFrom-Json; $row=$list | Where-Object {$_.name -eq $TunnelName} | Select-Object -First 1; $uuid=$row.id; if(-not $uuid){throw "Could not determine tunnel ID."}
@("tunnel: $uuid","credentials-file: $env:USERPROFILE\.cloudflared\$uuid.json","ingress:","  - hostname: $Hostname","    service: http://127.0.0.1:8787","  - service: http_status:404") | Set-Content -Encoding UTF8 $Config
$nodeExe=Join-Path $NodeDir "node.exe"
$nodeTask="`"$nodeExe`" `"$Bridge`""
$cfTask="`"$Cloudflared`" tunnel --config `"$Config`" run $TunnelName"
schtasks /Create /F /TN "Anish Tally Connector" /SC ONLOGON /RL HIGHEST /TR $nodeTask | Out-Null
schtasks /Create /F /TN "Anish Tally Cloudflare Tunnel" /SC ONLOGON /RL HIGHEST /TR $cfTask | Out-Null
Start-Process $nodeExe -ArgumentList @($Bridge) -WorkingDirectory $Base -WindowStyle Hidden
Start-Process $Cloudflared -ArgumentList @("tunnel","--config",$Config,"run",$TunnelName) -WorkingDirectory $Base -WindowStyle Hidden
Write-Host ""; Write-Host "Connector installed." -ForegroundColor Green; Write-Host "Office bridge: https://$Hostname"; Write-Host "Bridge token: $BridgeToken"; Write-Host "TallyPrime must be running with HTTP/XML server enabled on port 9000."
