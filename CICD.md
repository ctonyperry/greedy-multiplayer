# CI/CD Setup Guide

This guide explains how to set up automated deployment to Azure using GitHub Actions.

## Overview

The CI/CD pipeline consists of two workflows:

1. **CI (ci.yml)** - Runs on every PR and push to main
   - Type checking
   - Building
   - Running tests
   - Uploading artifacts

2. **Deploy (deploy.yml)** - Deploys to Azure on push to main
   - Builds the application
   - Deploys infrastructure via Bicep
   - Deploys server to App Service
   - Deploys client to Static Web App

## Prerequisites

1. Azure subscription
2. GitHub repository
3. Azure CLI installed locally (for initial setup)

## Initial Setup (One-Time)

### Step 1: Create Azure Service Principal

The GitHub Actions workflow needs credentials to deploy to Azure.

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "Your Subscription Name"

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "greedy-github-actions" \
  --role Contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth
```

This outputs JSON credentials. Copy the entire JSON output.

### Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions.

Add these **repository secrets**:

| Secret Name | Value |
|------------|-------|
| `AZURE_CREDENTIALS` | The entire JSON output from Step 1 |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | (Generated after first deployment - see Step 4) |

### Step 3: Configure GitHub Variables (Optional)

Go to Settings → Secrets and variables → Actions → Variables tab.

Add these **repository variables** for production builds:

| Variable Name | Example Value |
|--------------|---------------|
| `API_URL` | `https://greedy-api-dev.azurewebsites.net/api` |

### Step 4: First Deployment (Manual)

For the first deployment, run the infrastructure deployment manually to create the Static Web App:

```bash
# Create resource group
az group create --name greedy-rg-dev --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group greedy-rg-dev \
  --template-file infrastructure/main.bicep \
  --parameters infrastructure/parameters.dev.json
```

After deployment, get the Static Web App deployment token:

```bash
# Get the deployment token
az staticwebapp secrets list \
  --name greedy-swa-dev \
  --resource-group greedy-rg-dev \
  --query "properties.apiKey" -o tsv
```

Add this token as the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret in GitHub.

### Step 5: Update Client Environment Variables

After deployment, update the API URLs in GitHub Variables with your actual Azure URLs:

```bash
# Get your App Service URL
az webapp show --name greedy-api-dev --resource-group greedy-rg-dev --query defaultHostName -o tsv
```

## How It Works

### On Pull Request

1. Code is checked out
2. Dependencies are installed
3. TypeScript type checking runs
4. Server and client are built
5. Tests are run
6. Build artifacts are uploaded

### On Merge to Main

1. All CI steps run
2. Infrastructure is deployed/updated via Bicep
3. Server is deployed to App Service
4. Client is deployed to Static Web App

### Manual Deployment

You can manually trigger a deployment to any environment:

1. Go to Actions tab in GitHub
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Choose the environment (dev or prod)

## Local Development

For local development, the CI/CD pipeline is not involved:

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev
```

The client runs at `http://localhost:5173` and connects to the server at `http://localhost:3001`.

## Environment Configuration

### Development (Local)

Uses `.env` files:
- `client/.env` - Client environment variables
- `server/.env` - Server environment variables (create from `.env.example`)

### Production (Azure)

Environment variables are configured in:
- **App Service** - Application settings (configured by Bicep)
- **Static Web App** - Build-time variables (set in GitHub workflow)

## Adding a Production Environment

1. Create `infrastructure/parameters.prod.json` (already done)

2. Add GitHub environment:
   - Go to Settings → Environments → New environment
   - Name it "prod"
   - Add protection rules (require reviewers)

3. Add environment-specific secrets/variables:
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` (prod token)

4. Trigger manual deployment with "prod" environment

## Troubleshooting

### Deployment fails with authentication error

- Verify `AZURE_CREDENTIALS` secret is set correctly
- Check if service principal has Contributor role on subscription
- Ensure subscription ID in credentials matches your subscription

### Static Web App deployment fails

- Verify `AZURE_STATIC_WEB_APPS_API_TOKEN` is set
- Get a new token if needed:
  ```bash
  az staticwebapp secrets list --name greedy-swa-dev --resource-group greedy-rg-dev
  ```

### WebSocket connection fails

- Verify App Service has WebSockets enabled (set in Bicep)
- Check CORS settings in App Service
- Ensure `CLIENT_URL` app setting matches Static Web App URL

### Build fails with type errors

- Run locally: `npm run typecheck` in both server and client
- Ensure all dependencies are installed

## Costs

With free tiers, the infrastructure is nearly free:

| Resource | Tier | Cost |
|----------|------|------|
| Static Web App | Free | $0 |
| App Service | F1 Free | $0 (60 min CPU/day) |
| Cosmos DB | Serverless | ~$0 for low traffic |
| Application Insights | Free tier | $0 (5GB/month) |

For production, consider upgrading:
- App Service to B1 (~$13/month) for always-on
- Static Web App to Standard (~$9/month) for custom domains
