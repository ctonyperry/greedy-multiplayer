# Azure Infrastructure

This directory contains Bicep templates for deploying Greedy Multiplayer to Azure.

## Resources Created

- **Static Web App** - Frontend hosting (Free tier)
- **App Service** - Backend with Socket.IO (Free tier F1)
- **Cosmos DB** - Serverless NoSQL database
- **Application Insights** - Monitoring and logging
- **Log Analytics** - Log storage

## Prerequisites

1. Azure CLI installed
2. Azure subscription
3. Azure AD B2C tenant (created separately - see below)

## Deployment

### 1. Login to Azure

```bash
az login
az account set --subscription "Your Subscription Name"
```

### 2. Create Resource Group

```bash
az group create --name greedy-multiplayer-rg --location eastus
```

### 3. Deploy Infrastructure

```bash
az deployment group create \
  --resource-group greedy-multiplayer-rg \
  --template-file main.bicep \
  --parameters parameters.dev.json
```

### 4. Get Outputs

```bash
az deployment group show \
  --resource-group greedy-multiplayer-rg \
  --name main \
  --query properties.outputs
```

## Azure AD B2C Setup (Manual)

Azure AD B2C must be set up manually through the Azure Portal:

1. Create an Azure AD B2C tenant
2. Register a SPA application
3. Add Google as an identity provider
4. Create a sign-up/sign-in user flow
5. Configure redirect URIs for your Static Web App

See the [Azure AD B2C documentation](https://docs.microsoft.com/azure/active-directory-b2c/) for details.

## Environment-Specific Deployments

Create additional parameter files for other environments:

- `parameters.dev.json` - Development
- `parameters.staging.json` - Staging
- `parameters.prod.json` - Production

## Costs

With free tiers:
- Static Web App: Free
- App Service F1: Free (60 minutes/day CPU)
- Cosmos DB Serverless: Pay per request (first 1M RU/month often free)
- Application Insights: 5GB/month free
