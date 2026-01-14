# Deployment Guide

This document covers how to deploy both the frontend (client) and backend (server) for the Greedy dice game.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Azure Static Web Apps                                          │
│  - Auto-deploys on push to main                                 │
│  - GitHub Actions workflow                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  Azure App Service                                               │
│  - Manual deployment via script                                  │
│  - WebSocket support for real-time game updates                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  Azure Cosmos DB                                                 │
│  - Game state persistence                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Deployment

### Automatic Deployment (Recommended)

The frontend automatically deploys when you push to the `main` branch.

```bash
# Just push your changes
git push origin main
```

**What happens:**
1. GitHub Actions runs `.github/workflows/deploy.yml`
2. Builds the client with production environment variables
3. Deploys to Azure Static Web Apps
4. Live within ~2 minutes

### Manual Deployment

If you need to deploy manually or the GitHub Action fails:

```bash
cd client

# Build with production environment
VITE_API_URL=https://<your-app-service>.azurewebsites.net/api \
VITE_SOCKET_URL=https://<your-app-service>.azurewebsites.net \
npm run build

# Deploy using Azure CLI (requires SWA CLI)
npm install -g @azure/static-web-apps-cli
swa deploy ./dist --env production
```

### Environment Variables

The frontend build uses these environment variables (set as GitHub Secrets):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (e.g., `https://<app-name>.azurewebsites.net/api`) |
| `VITE_SOCKET_URL` | Backend WebSocket URL (e.g., `https://<app-name>.azurewebsites.net`) |

### Monitoring Frontend Deployment

```bash
# Check GitHub Actions status
gh run list --workflow=deploy.yml

# Watch a specific run
gh run watch
```

---

## Backend Deployment

### Quick Start

```bash
cd server

# Set required environment variables
export AZURE_WEBAPP_NAME=<your-app-name>
export AZURE_RESOURCE_GROUP=<your-resource-group>

# Full deploy (build + deploy)
npm run deploy

# Quick deploy (skip build if dist/ is current)
npm run deploy:quick
```

### What the Deploy Script Does

1. **Install dependencies** - `npm ci --omit=dev` (production only)
2. **Build TypeScript** - Compiles `src/` to `dist/`
3. **Create package** - Zips `dist/`, `node_modules/`, `package.json`
4. **Deploy to Azure** - Uploads with `--clean true` flag
5. **Health check** - Verifies the app is running

### Prerequisites

- Azure CLI installed and logged in (`az login`)
- Node.js 20+ and npm installed

```bash
# Verify Azure CLI is logged in
az account show
```

### Manual Deployment Steps

If you prefer to run steps manually:

```bash
cd server

# 1. Install production dependencies
npm ci --omit=dev

# 2. Build TypeScript
npm run build

# 3. Create deployment zip
zip -r server-deploy.zip dist/ node_modules/ package.json package-lock.json

# 4. Deploy to Azure
az webapp deploy \
  --resource-group <your-resource-group> \
  --name <your-app-name> \
  --src-path server-deploy.zip \
  --type zip \
  --clean true \
  --restart true

# 5. Verify health
curl https://<your-app-name>.azurewebsites.net/health
```

### Environment Variables

Backend environment variables are configured in Azure App Service:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (set by Azure) |
| `COSMOS_ENDPOINT` | Azure Cosmos DB endpoint |
| `COSMOS_KEY` | Azure Cosmos DB key |
| `FIREBASE_*` | Firebase Admin SDK credentials |
| `CLIENT_URL` | Allowed CORS origin |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` (we pre-build) |
| `ENABLE_ORYX_BUILD` | `false` (we pre-build) |

To update environment variables:

```bash
az webapp config appsettings set \
  --resource-group <your-resource-group> \
  --name <your-app-name> \
  --settings KEY=value
```

### Viewing Logs

```bash
# Stream live logs
az webapp log tail -g <your-resource-group> -n <your-app-name>

# View recent logs
az webapp log download -g <your-resource-group> -n <your-app-name>

# Check app status
az webapp show -g <your-resource-group> -n <your-app-name> --query state
```

---

## CI Pipeline

Every push and PR runs the CI pipeline (`.github/workflows/ci.yml`):

- Type checks both client and server
- Builds both projects
- Runs tests (if any)
- Uploads build artifacts

```bash
# Check CI status
gh run list --workflow=ci.yml
```

---

## Troubleshooting

### Frontend Issues

**Build fails in GitHub Actions:**
```bash
# Check the workflow logs
gh run view --log-failed
```

**Site not updating:**
- Check if the deploy workflow completed
- Hard refresh browser (Cmd+Shift+R)
- Check Azure Static Web Apps portal for deployment status

### Backend Issues

**Deploy script fails:**
```bash
# Check Azure CLI is logged in
az account show

# Check webapp exists
az webapp show -g <your-resource-group> -n <your-app-name>
```

**App not starting after deploy:**
```bash
# Check logs for errors
az webapp log tail -g <your-resource-group> -n <your-app-name>

# Restart the app
az webapp restart -g <your-resource-group> -n <your-app-name>
```

**Health check fails:**
```bash
# Check if app is running
curl -v https://<your-app-name>.azurewebsites.net/health

# Check CORS configuration (in server/src/index.ts)
# Ensure your domain is in allowedOrigins
```

### Database Issues

```bash
# Check Cosmos DB connection from Azure portal
# Or test with Azure CLI
az cosmosdb show -g <your-resource-group> -n <cosmos-account-name>
```

---

## Quick Reference

```bash
# Deploy frontend (automatic)
git push origin main

# Deploy backend
export AZURE_WEBAPP_NAME=<your-app-name>
export AZURE_RESOURCE_GROUP=<your-resource-group>
cd server && npm run deploy

# View backend logs
az webapp log tail -g <your-resource-group> -n <your-app-name>

# Check deployment status
gh run list
```
