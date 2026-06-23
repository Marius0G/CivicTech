# Build the web app (react-native-web) and deploy it to Azure Blob static-website hosting.
#
# Live site: https://civictechweb.z1.web.core.windows.net/  (HTTPS — required for mic/camera)
# Prereqs:  az login  (subscription "Azure for Students"); Microsoft.Storage provider registered.
# Usage:    ./deploy/web-deploy.ps1
$ErrorActionPreference = "Stop"
$ACCOUNT = "civictechweb"
$RG      = "civictech-rg"
$root    = Split-Path $PSScriptRoot -Parent

Set-Location "$root\mobile"
Write-Host "==> Building web export..." -ForegroundColor Cyan
$env:CI = "1"
npx expo export -p web

Write-Host "==> Uploading dist to `$web..." -ForegroundColor Cyan
$key = az storage account keys list -g $RG -n $ACCOUNT --query "[0].value" -o tsv
az storage blob upload-batch --account-name $ACCOUNT --account-key $key -s "$root\mobile\dist" -d '$web' --overwrite | Out-Null

$url = az storage account show -n $ACCOUNT -g $RG --query "primaryEndpoints.web" -o tsv
Write-Host "==> Deployed: $url" -ForegroundColor Green
