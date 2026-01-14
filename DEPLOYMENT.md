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
│  Fly.io                                                          │
│  - Manual deployment via flyctl                                  │
│  - WebSocket support for real-time game updates                 │
│  - Auto-scales to zero when idle (free tier)                    │
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

### Environment Variables

The frontend build uses these environment variables (set as GitHub Secrets):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (`https://greedy-api.fly.dev/api`) |
| `VITE_SOCKET_URL` | Backend WebSocket URL (`https://greedy-api.fly.dev`) |

### Monitoring Frontend Deployment

```bash
# Check GitHub Actions status
gh run list --workflow=deploy.yml

# Watch a specific run
gh run watch
```

---

## Backend Deployment

The backend runs on [Fly.io](https://fly.io), a platform with a generous free tier that supports WebSockets.

### Prerequisites

1. Install the Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Log in to Fly.io:
   ```bash
   flyctl auth login
   ```

### Deploy

```bash
cd server

# Build TypeScript
npm run build

# Deploy to Fly.io
flyctl deploy
```

That's it! The deployment typically takes ~30 seconds.

### Configuration

The backend configuration is in `server/fly.toml`:

```toml
app = 'greedy-api'
primary_region = 'sjc'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'    # Scales to zero when idle
  auto_start_machines = true     # Wakes on incoming request
  min_machines_running = 0

[env]
  PORT = '8080'
  NODE_ENV = 'production'

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Environment Variables (Secrets)

Secrets are managed via Fly.io:

```bash
# View current secrets
flyctl secrets list --app greedy-api

# Set a secret
flyctl secrets set KEY=value --app greedy-api
```

Required secrets:

| Secret | Description |
|--------|-------------|
| `COSMOS_CONNECTION` | Azure Cosmos DB connection string |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `CLIENT_URL` | Allowed CORS origin (e.g., `https://getgreedy.io`) |

### Viewing Logs

```bash
# Stream live logs
flyctl logs --app greedy-api

# View recent logs
flyctl logs --app greedy-api -n 100
```

### Monitoring

```bash
# Check app status
flyctl status --app greedy-api

# View machines
flyctl machines list --app greedy-api

# Open Fly.io dashboard
flyctl dashboard --app greedy-api
```

### Scaling

The app auto-scales to zero when idle and wakes on incoming requests (~2-3 second cold start). To keep it always running:

```bash
# Edit fly.toml and set:
# min_machines_running = 1

# Then redeploy
flyctl deploy
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

**Deploy fails:**
```bash
# Check Fly.io status
flyctl status --app greedy-api

# View deployment logs
flyctl logs --app greedy-api
```

**App not responding:**
```bash
# Check if machines are running
flyctl machines list --app greedy-api

# Restart the app
flyctl apps restart greedy-api
```

**Health check fails:**
```bash
# Test health endpoint
curl https://greedy-api.fly.dev/health

# Check logs for errors
flyctl logs --app greedy-api
```

**WebSocket connection issues:**
- Verify CSP in `client/public/staticwebapp.config.json` includes `*.fly.dev`
- Check CORS origins in `server/src/index.ts`

### Database Issues

```bash
# Check Cosmos DB connection from Azure portal
# Verify COSMOS_CONNECTION secret is set correctly
flyctl secrets list --app greedy-api
```

---

## URLs

| Service | URL |
|---------|-----|
| Frontend | https://getgreedy.io |
| Backend API | https://greedy-api.fly.dev/api |
| Backend WebSocket | wss://greedy-api.fly.dev |
| Backend Health | https://greedy-api.fly.dev/health |

---

## Quick Reference

```bash
# Deploy frontend (automatic)
git push origin main

# Deploy backend
cd server && npm run build && flyctl deploy

# View backend logs
flyctl logs --app greedy-api

# Check deployment status
gh run list
```
