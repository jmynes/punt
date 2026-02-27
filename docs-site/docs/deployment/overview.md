---
sidebar_position: 1
---

# Deployment Overview

PUNT can be deployed in several ways depending on your needs.

## Deployment Options

| Option | Best For | Database | Complexity |
|--------|----------|----------|------------|
| [Railway](/deployment/railway) | Quick cloud deployment | PostgreSQL | Low |
| [Self-Hosted](/deployment/self-hosted) | Full control | PostgreSQL | Medium |
| Demo Mode | Evaluation | localStorage | Minimal |

## Requirements

### Node.js

PUNT requires **Node.js 20 or later** (Next.js 16 requirement).

Check your version:
```bash
node --version
# Should output v20.x.x or higher
```

### Package Manager

pnpm is recommended:
```bash
npm install -g pnpm
```

### Environment Variables

All deployments need certain environment variables:

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_SECRET` | NextAuth.js secret key | `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/punt` |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_TRUST_HOST` | Trust proxy headers | `false` |
| `TRUST_PROXY` | Trust X-Forwarded-For | `false` |
| `NEXT_PUBLIC_DEMO_MODE` | Enable demo mode | `false` |

### Generating AUTH_SECRET

Generate a secure secret:

```bash
openssl rand -base64 32
```

Or use Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Build Process

### Production Build

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Build the application
pnpm build
```

### Start Production Server

```bash
pnpm start
```

The server starts on port 3000 by default.

## Database Setup

### PostgreSQL (Required)

PUNT requires PostgreSQL 16 or later. Set the `DATABASE_URL` environment variable to your PostgreSQL connection string:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/punt
```

Once configured, initialize the schema:

```bash
# Create database tables
pnpm db:push
```

## File Storage

Uploaded files are stored in the `uploads/` directory:

```
uploads/
├── avatars/       # User profile pictures
├── attachments/   # Ticket attachments
└── files/         # General uploads
```

### Persistent Storage

Ensure the uploads directory is:
1. Persistent (not ephemeral)
2. Backed up regularly
3. Has sufficient disk space

## Reverse Proxy

When running behind a reverse proxy (nginx, Caddy, etc.):

### Enable Trust Proxy

```env
AUTH_TRUST_HOST=true
TRUST_PROXY=true
```

### Nginx Configuration

```nginx
server {
  listen 80;
  server_name punt.example.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # SSE support
    proxy_buffering off;
    proxy_cache off;
  }
}
```

### Caddy Configuration

```caddy
punt.example.com {
  reverse_proxy localhost:3000
}
```

Caddy automatically handles HTTPS and headers.

## Security Checklist

Before deploying to production:

- [ ] Generate a strong `AUTH_SECRET`
- [ ] Set `AUTH_TRUST_HOST=true` only behind trusted proxy
- [ ] Set `TRUST_PROXY=true` only behind trusted proxy
- [ ] Enable HTTPS (via reverse proxy or directly)
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Review file upload limits
- [ ] Test rate limiting

## Monitoring

### Health Check

PUNT responds to requests at the root path:

```bash
curl http://localhost:3000/
```

### Logs

Application logs are written to stdout. Use your platform's log aggregation:

- **Railway**: Built-in log viewer
- **Docker**: `docker logs <container>`
- **systemd**: `journalctl -u punt`

## Scaling

### Horizontal Scaling

PUNT uses PostgreSQL, which supports concurrent connections natively. You can run multiple PUNT instances pointed at the same database for horizontal scaling.

### Vertical Scaling

For more capacity:
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`
- Add more CPU cores
- Use SSD storage for database

## Backup Strategy

### Database Backup

Regular PostgreSQL backups:

```bash
pg_dump $DATABASE_URL > backup.sql
```

Or use PUNT's built-in export:
1. Admin Panel → Database → Export
2. Store the JSON backup securely

### File Backup

Backup the uploads directory:

```bash
tar -czf uploads-backup.tar.gz /path/to/uploads/
```

## Next Steps

- [Deploy to Railway](/deployment/railway) - Quick cloud deployment
- [Self-Hosted Guide](/deployment/self-hosted) - Full control deployment
