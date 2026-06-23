<#
  Deploy / update the EU Youth Buddy backend on Azure Container Apps.

  Builds the image SERVER-SIDE in Azure Container Registry, then points the
  Container App at the new image. Safe to re-run any time you change backend code.

  Why not `az containerapp up`? On Windows that path streams ACR build logs through
  colorama and crashes with a cp1252 UnicodeEncodeError. The build itself runs
  server-side and succeeds regardless, so we build with `az acr build`, ignore the
  cosmetic streaming crash, verify the image tag landed, then update the app.

  Prereqs (run once, after `az login`):
    az extension add --name containerapp --upgrade
    az provider register --namespace Microsoft.App
    az provider register --namespace Microsoft.OperationalInsights

  Usage:  ./deploy/azure-deploy.ps1
#>

$ErrorActionPreference = 'Stop'

# ---- Settings ------------------------------------------------------------
$ResourceGroup = 'civictech-rg'
$Location      = 'swedencentral'
$Environment   = 'civictech-env'
$AppName       = 'civictech-backend'
$ImageRepo     = 'civictech-backend'
# --------------------------------------------------------------------------

$root       = Split-Path $PSScriptRoot -Parent
$backendDir = Join-Path $root 'backend'
$envFile    = Join-Path $backendDir '.env'

# ---- Read secrets from backend/.env --------------------------------------
if (-not (Test-Path $envFile)) { throw "Missing $envFile - cannot read API keys." }
$envMap = @{}
foreach ($line in Get-Content $envFile) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
    $k, $v = $t.Split('=', 2)
    $envMap[$k.Trim()] = $v.Trim()
}
$openaiKey = $envMap['OPENAI_API_KEY']
$tavilyKey = $envMap['TAVILY_API_KEY']
if (-not $openaiKey) { throw "OPENAI_API_KEY not found in $envFile" }

# ---- Ensure resource group + Container Apps environment exist -------------
Write-Host "==> Ensuring resource group + environment..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location -o none
$envExists = az containerapp env show -n $Environment -g $ResourceGroup --query name -o tsv 2>$null
if (-not $envExists) {
    az containerapp env create -n $Environment -g $ResourceGroup --location $Location -o none
}

# ---- Ensure an ACR exists (reuse the first one in the RG, else create) ----
$Acr = az acr list -g $ResourceGroup --query "[0].name" -o tsv 2>$null
if (-not $Acr) {
    $Acr = "civictechacr$((Get-Random -Maximum 999999).ToString('000000'))"
    Write-Host "==> Creating ACR $Acr..." -ForegroundColor Cyan
    az acr create -n $Acr -g $ResourceGroup --sku Basic --admin-enabled true -o none
}
$acrServer = az acr show -n $Acr --query loginServer -o tsv

# ---- Build the image SERVER-SIDE; tolerate the Windows log-stream crash ---
$tag   = "v$(Get-Date -Format yyyyMMddHHmmss)"
$image = "$acrServer/$ImageRepo`:$tag"
Write-Host "==> Building $image in ACR (this runs in the cloud)..." -ForegroundColor Cyan
Push-Location $backendDir
try {
    # The crash happens while STREAMING logs; the build keeps going server-side.
    az acr build --registry $Acr --image "$ImageRepo`:$tag" . *> $null
} catch { }
finally { Pop-Location }

# ---- Wait until the new tag actually appears in the registry --------------
Write-Host "==> Waiting for the build to finish server-side..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(15)
$built = $false
while ((Get-Date) -lt $deadline) {
    $tags = az acr repository show-tags --name $Acr --repository $ImageRepo -o tsv 2>$null
    if ($tags -and ($tags -split "`n" | ForEach-Object { $_.Trim() }) -contains $tag) { $built = $true; break }
    Start-Sleep -Seconds 10
}
if (-not $built) { throw "Build did not produce image tag '$tag' within 15 min. Check: az acr task list-runs --registry $Acr -o table" }
Write-Host "    Image ready: $image" -ForegroundColor Green

# ---- Registry credentials for the pull -----------------------------------
az acr update -n $Acr --admin-enabled true -o none
$acrUser = az acr credential show -n $Acr --query username -o tsv
$acrPass = az acr credential show -n $Acr --query "passwords[0].value" -o tsv

# ---- Create the app (first run) or update it (subsequent runs) ------------
$appExists = az containerapp show -n $AppName -g $ResourceGroup --query name -o tsv 2>$null
$envArgs = @("OPENAI_API_KEY=secretref:openai-key")
$secrets = @("openai-key=$openaiKey")
if ($tavilyKey) { $envArgs += "TAVILY_API_KEY=secretref:tavily-key"; $secrets += "tavily-key=$tavilyKey" }

if (-not $appExists) {
    Write-Host "==> Creating container app..." -ForegroundColor Cyan
    az containerapp create `
        --name $AppName --resource-group $ResourceGroup --environment $Environment `
        --image $image --target-port 8000 --ingress external `
        --registry-server $acrServer --registry-username $acrUser --registry-password $acrPass `
        --min-replicas 0 --max-replicas 2 `
        --secrets $secrets `
        --env-vars $envArgs -o none
} else {
    Write-Host "==> Updating container app to new image..." -ForegroundColor Cyan
    az containerapp secret set -n $AppName -g $ResourceGroup --secrets $secrets -o none
    az containerapp registry set -n $AppName -g $ResourceGroup --server $acrServer --username $acrUser --password $acrPass -o none
    az containerapp update -n $AppName -g $ResourceGroup --image $image --set-env-vars $envArgs -o none
}

# ---- Show the public URL -------------------------------------------------
$fqdn = az containerapp show -n $AppName -g $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Host ""
Write-Host "==> Deployed. Public URL:" -ForegroundColor Green
Write-Host "    https://$fqdn"
Write-Host ""
Write-Host "Set in mobile/src/config.ts ->  BACKEND_URL = 'https://$fqdn'"
Write-Host "Health check:  curl https://$fqdn/health"
