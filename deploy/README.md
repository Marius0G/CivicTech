# Deploying the backend to Azure (Container Apps)

**Live URL:** https://civictech-backend.jollyground-eead5389.swedencentral.azurecontainerapps.io
(already wired into `mobile/src/config.ts`)

Hosts the FastAPI backend on **Azure Container Apps** (region: **Sweden Central**) — scales to zero, so with
light personal use it costs ~€0–2/month (your €40 student credit lasts a long time).

Resources (all in resource group `civictech-rg`): the Container App `civictech-backend`,
its environment `civictech-env`, and an Azure Container Registry that holds the image.

## What gets deployed
- `backend/Dockerfile` — python:3.12-slim image with the app **and the pre-seeded
  Chroma DB baked in** (no re-embedding on boot, no persistent volume needed).
- Public **HTTPS** URL so the mobile app works from anywhere.
- API keys read from `backend/.env` and stored as Azure **secrets** (not plaintext).

## One-time setup (after you have Azure CLI + are logged in)
```powershell
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

## Deploy / update (re-run any time you change backend code)
```powershell
./deploy/azure-deploy.ps1
```
It builds the image **in the cloud** (Azure Container Registry — no local Docker
needed), waits for the build, then creates the app on first run or updates it to the
new image on later runs. The public URL stays the same across updates.

> Note: on Windows the Azure CLI prints a `UnicodeEncodeError` (cp1252) while
> streaming build logs. That's a cosmetic CLI bug — the build runs server-side and
> the script verifies the image landed before continuing, so it's safe to ignore.

## After the first deploy
1. Put the printed URL into `mobile/src/config.ts` as `BACKEND_URL` (already done).
2. Sanity check: `curl https://<your-app>.azurecontainerapps.io/health`

## Cost control
- Scale-to-zero is set (`--min-replicas 0`), so idle = no charge.
- To stop spending entirely: `az containerapp update -n civictech-backend -g civictech-rg --min-replicas 0 --max-replicas 0`
- To tear everything down: `az group delete --name civictech-rg --yes`
