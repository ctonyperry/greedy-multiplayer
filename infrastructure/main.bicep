/**
 * Azure infrastructure for Greedy Multiplayer Game
 *
 * Resources:
 * - Static Web App (frontend)
 * - App Service (backend with Socket.IO)
 * - Cosmos DB (serverless)
 * - Application Insights (monitoring)
 */

@description('Location for all resources')
param location string = 'eastus2'

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Base name for resources')
param baseName string = 'greedy'

// Resource name variables
var staticWebAppName = '${baseName}-swa-${environment}'
var appServicePlanName = '${baseName}-plan-${environment}'
var appServiceName = '${baseName}-api-${environment}'
var cosmosAccountName = '${baseName}-cosmos-${environment}'
var appInsightsName = '${baseName}-insights-${environment}'
var logAnalyticsName = '${baseName}-logs-${environment}'

// ============================================
// Log Analytics Workspace (for App Insights)
// ============================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ============================================
// Application Insights
// ============================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ============================================
// Static Web App (Frontend)
// ============================================
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Note: Repository connection configured via GitHub Actions
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

// ============================================
// App Service Plan (for Backend)
// ============================================
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'  // Basic tier (~$13/month)
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true  // Required for Linux
  }
}

// ============================================
// App Service (Backend with Socket.IO)
// ============================================
resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      webSocketsEnabled: true  // Required for Socket.IO
      alwaysOn: true  // Keep app warm (B1 supports this)
      appSettings: [
        {
          name: 'COSMOS_CONNECTION'
          value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'CLIENT_URL'
          value: 'https://${staticWebApp.properties.defaultHostname}'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : 'development'
        }
      ]
    }
  }
}

// ============================================
// Cosmos DB Account (Serverless)
// ============================================
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
  }
}

// ============================================
// Cosmos DB Database
// ============================================
resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: 'greedy-multiplayer'
  properties: {
    resource: {
      id: 'greedy-multiplayer'
    }
  }
}

// ============================================
// Cosmos DB Containers
// ============================================
resource usersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
    }
  }
}

resource gamesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'games'
  properties: {
    resource: {
      id: 'games'
      partitionKey: {
        paths: ['/code']
        kind: 'Hash'
      }
      defaultTtl: 604800  // 7 days TTL for finished games
    }
  }
}

resource leaderboardContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'leaderboard'
  properties: {
    resource: {
      id: 'leaderboard'
      partitionKey: {
        paths: ['/period']
        kind: 'Hash'
      }
    }
  }
}

// ============================================
// Outputs
// ============================================
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appServiceName string = appService.name
output cosmosAccountName string = cosmosAccount.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
