#!/bin/bash
#
# Backend Deployment Script for Azure App Service
# Usage: ./deploy.sh [--skip-build]
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Node.js and npm installed
#
# Environment variables (required):
#   AZURE_WEBAPP_NAME - App Service name (e.g., my-app-dev)
#   AZURE_RESOURCE_GROUP - Resource group (e.g., my-resource-group)
#

set -e  # Exit on error

# Configuration
WEBAPP_NAME="${AZURE_WEBAPP_NAME:?Environment variable AZURE_WEBAPP_NAME is required}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:?Environment variable AZURE_RESOURCE_GROUP is required}"
DEPLOY_ZIP="server-deploy.zip"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  Backend Deployment to Azure App Service"
echo "=========================================="
echo ""
log_info "Target: $WEBAPP_NAME ($RESOURCE_GROUP)"
echo ""

# Parse arguments
SKIP_BUILD=false
for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
    esac
done

# Step 1: Install dependencies
log_info "Step 1/5: Installing dependencies..."
npm ci --omit=dev
log_success "Dependencies installed"

# Step 2: Build TypeScript (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    log_info "Step 2/5: Building TypeScript..."
    npm run build
    log_success "Build complete"
else
    log_warn "Step 2/5: Skipping build (--skip-build flag)"
fi

# Verify dist exists
if [ ! -d "dist" ]; then
    log_error "dist/ directory not found. Run without --skip-build flag."
    exit 1
fi

# Step 3: Create deployment package
log_info "Step 3/5: Creating deployment package..."
rm -f "$DEPLOY_ZIP"

# Create zip with dist/, node_modules/, package.json, and package-lock.json
zip -rq "$DEPLOY_ZIP" dist/ node_modules/ package.json package-lock.json

DEPLOY_SIZE=$(du -h "$DEPLOY_ZIP" | cut -f1)
log_success "Package created: $DEPLOY_ZIP ($DEPLOY_SIZE)"

# Step 4: Deploy to Azure
log_info "Step 4/5: Deploying to Azure App Service..."
log_info "This may take 1-2 minutes..."

az webapp deploy \
    --resource-group "$RESOURCE_GROUP" \
    --name "$WEBAPP_NAME" \
    --src-path "$DEPLOY_ZIP" \
    --type zip \
    --clean true \
    --restart true \
    --async false

log_success "Deployment complete"

# Step 5: Verify deployment
log_info "Step 5/5: Verifying deployment..."
sleep 5  # Give the app a moment to restart

HEALTH_URL="https://${WEBAPP_NAME}.azurewebsites.net/health"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    log_success "Health check passed (HTTP $HTTP_STATUS)"
else
    log_warn "Health check returned HTTP $HTTP_STATUS (app may still be starting)"
    log_info "Check manually: $HEALTH_URL"
fi

echo ""
echo "=========================================="
log_success "Deployment finished!"
echo "=========================================="
echo ""
echo "  App URL: https://${WEBAPP_NAME}.azurewebsites.net"
echo "  Health:  $HEALTH_URL"
echo ""
echo "  View logs:"
echo "    az webapp log tail -g $RESOURCE_GROUP -n $WEBAPP_NAME"
echo ""
