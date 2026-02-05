---
sidebar_position: 2
---

# Deploy to Railway

[Railway](https://railway.app) provides easy deployment with persistent storage for SQLite.

## Quick Deploy

### 1. Fork the Repository

Fork [github.com/jmynes/punt](https://github.com/jmynes/punt) to your GitHub account.

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your forked PUNT repository

### 3. Configure Environment Variables

Add the following environment variables in Railway:

| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `DATABASE_URL` | `file:/app/data/punt.db` |
| `AUTH_TRUST_HOST` | `true` |

### 4. Configure Persistent Storage

PUNT needs persistent storage for the SQLite database:

1. In your Railway project, click **+ New**
2. Select **Volume**
3. Configure mount path: `/app/data`
4. Set volume size (1GB is plenty for most use cases)

### 5. Deploy

Railway will automatically:
1. Detect the Nixpacks configuration
2. Install dependencies with pnpm
3. Build the Next.js application
4. Start the production server

## Configuration Files

PUNT includes Railway-specific configuration:

### railway.toml

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "pnpm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### .node-version

Specifies Node.js 20 (required by Next.js 16).

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | JWT signing secret |
| `DATABASE_URL` | SQLite database path |
| `AUTH_TRUST_HOST` | Trust Railway's proxy |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` (Railway sets this) |
| `TRUST_PROXY` | Trust X-Forwarded-For | `true` recommended |

## Demo Mode Deployment

For a demo/preview deployment without persistence:

```env
NEXT_PUBLIC_DEMO_MODE=true
AUTH_SECRET=any-secret-value
AUTH_TRUST_HOST=true
DATABASE_URL=file:./demo.db
```

This runs entirely client-side with localStorage.

## Custom Domain

### Add Custom Domain

1. Go to your Railway service settings
2. Click **Settings** → **Networking**
3. Add your custom domain
4. Configure DNS as instructed

Railway provides free HTTPS certificates via Let's Encrypt.

## Troubleshooting

### Database Errors

If you see Prisma errors on startup:

1. Ensure the volume is mounted at `/app/data`
2. Check `DATABASE_URL` points to the mounted volume
3. The database file is created automatically on first run

### Build Failures

Check that:
- Node.js 20+ is being used (`.node-version` file)
- pnpm is available (Railway uses Nixpacks which supports pnpm)

### Memory Issues

If the build runs out of memory:

1. Go to service settings
2. Increase memory limit
3. Redeploy

## Monitoring

### View Logs

1. Go to your Railway service
2. Click **Deployments**
3. Select a deployment to view logs

### Metrics

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network traffic

## Scaling

### Upgrade Plan

Railway's free tier includes:
- 500 hours of runtime per month
- 1GB persistent storage

For production use, consider the Developer plan for:
- Unlimited runtime
- More storage
- Custom domains

### Volume Size

Increase volume size in Railway settings if needed:
1. Go to the Volume
2. Click **Settings**
3. Adjust size

## Backup

### Export Database

Use PUNT's built-in export:
1. Log in as admin
2. Go to Admin Panel → Database
3. Click Export

### Manual Backup

SSH into Railway (requires Pro plan) or use Railway CLI:

```bash
railway run cat /app/data/punt.db > backup.db
```

## Updates

### Deploy Updates

When you push to your repository:
1. Railway detects the change
2. Builds automatically
3. Zero-downtime deployment

### Manual Redeploy

1. Go to your Railway service
2. Click **Deployments**
3. Click **Redeploy**
