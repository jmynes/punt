---
sidebar_position: 3
---

# Self-Hosted Deployment

Deploy PUNT on your own infrastructure for full control.

## Prerequisites

- Node.js 20 or later
- pnpm (or npm/yarn)
- A server (VPS, dedicated, or local)
- Optional: nginx or Caddy for reverse proxy

## Installation

### Clone Repository

```bash
git clone https://github.com/jmynes/punt.git
cd punt
```

### Install Dependencies

```bash
pnpm install
```

### Configure Environment

Create a `.env` file:

```env
# Required
AUTH_SECRET=your-secret-key-here
DATABASE_URL=file:/var/data/punt/punt.db

# If behind reverse proxy
AUTH_TRUST_HOST=true
TRUST_PROXY=true
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### Set Up Database

Create the database directory:

```bash
sudo mkdir -p /var/data/punt
sudo chown $USER:$USER /var/data/punt
```

Initialize the database:

```bash
pnpm db:push
```

### Build Application

```bash
pnpm build
```

### Start Server

```bash
pnpm start
```

PUNT is now running at `http://localhost:3000`.

## Production Setup

### Process Manager (PM2)

Use PM2 to keep PUNT running:

```bash
# Install PM2
npm install -g pm2

# Start PUNT
pm2 start pnpm --name punt -- start

# Save process list
pm2 save

# Enable startup script
pm2 startup
```

PM2 commands:

```bash
pm2 status       # View status
pm2 logs punt    # View logs
pm2 restart punt # Restart
pm2 stop punt    # Stop
```

### Systemd Service

Alternative to PM2, use systemd:

Create `/etc/systemd/system/punt.service`:

```ini
[Unit]
Description=PUNT Ticketing System
After=network.target

[Service]
Type=simple
User=punt
WorkingDirectory=/opt/punt
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=10

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/opt/punt/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable punt
sudo systemctl start punt
```

## Reverse Proxy

### Nginx

Install nginx:

```bash
sudo apt install nginx
```

Create `/etc/nginx/sites-available/punt`:

```nginx
server {
    listen 80;
    server_name punt.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name punt.example.com;

    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/punt.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/punt.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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
        proxy_read_timeout 86400;
    }

    # File upload size
    client_max_body_size 100M;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/punt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Caddy

Simpler alternative with automatic HTTPS:

Install Caddy:

```bash
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```caddy
punt.example.com {
    reverse_proxy localhost:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy automatically obtains and renews SSL certificates.

## SSL/HTTPS

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d punt.example.com

# Auto-renewal (usually configured automatically)
sudo certbot renew --dry-run
```

## File Storage

### Configure Upload Directory

By default, uploads go to `./uploads/`. For production:

1. Create dedicated directory:
   ```bash
   sudo mkdir -p /var/data/punt/uploads
   sudo chown punt:punt /var/data/punt/uploads
   ```

2. Symlink or configure path (if needed in future releases)

### Backup Uploads

Add to your backup script:

```bash
rsync -av /var/data/punt/uploads/ /backup/punt/uploads/
```

## Database Backup

### Automated Backups

Create `/opt/punt/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR=/backup/punt
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 /var/data/punt/punt.db ".backup $BACKUP_DIR/punt_$DATE.db"

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/data/punt/uploads/

# Keep last 7 days of backups
find $BACKUP_DIR -name "punt_*.db" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete
```

Schedule with cron:

```bash
crontab -e
# Add:
0 2 * * * /opt/punt/backup.sh
```

### Restore from Backup

```bash
# Stop PUNT
sudo systemctl stop punt

# Restore database
cp /backup/punt/punt_YYYYMMDD.db /var/data/punt/punt.db

# Restore uploads
tar -xzf /backup/punt/uploads_YYYYMMDD.tar.gz -C /

# Start PUNT
sudo systemctl start punt
```

## Security Hardening

### Firewall

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Dedicated User

Run PUNT as a dedicated user:

```bash
# Create user
sudo useradd -r -s /bin/false punt

# Set ownership
sudo chown -R punt:punt /opt/punt
sudo chown -R punt:punt /var/data/punt
```

### Environment Security

Protect the `.env` file:

```bash
chmod 600 /opt/punt/.env
chown punt:punt /opt/punt/.env
```

## Updates

### Update Process

```bash
# Stop PUNT
sudo systemctl stop punt

# Backup database
sqlite3 /var/data/punt/punt.db ".backup /var/data/punt/punt_before_update.db"

# Pull updates
cd /opt/punt
git pull

# Install dependencies
pnpm install

# Run migrations
pnpm db:push

# Build
pnpm build

# Start PUNT
sudo systemctl start punt
```

### Rollback

If an update fails:

```bash
# Stop PUNT
sudo systemctl stop punt

# Restore database
cp /var/data/punt/punt_before_update.db /var/data/punt/punt.db

# Checkout previous version
git checkout <previous-tag>

# Rebuild
pnpm install
pnpm build

# Start PUNT
sudo systemctl start punt
```

## Monitoring

### Log Rotation

Create `/etc/logrotate.d/punt`:

```
/var/log/punt/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 punt punt
    sharedscripts
    postrotate
        systemctl reload punt >/dev/null 2>&1 || true
    endscript
}
```

### Health Monitoring

Simple health check script:

```bash
#!/bin/bash
if ! curl -sf http://localhost:3000/ > /dev/null; then
    echo "PUNT is down!"
    # Send alert (email, Slack, etc.)
fi
```

Add to cron for periodic checks:

```bash
*/5 * * * * /opt/punt/health-check.sh
```

## Docker (Alternative)

If you prefer containerization, create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build
RUN pnpm build

# Expose port
EXPOSE 3000

# Start
CMD ["pnpm", "start"]
```

Build and run:

```bash
docker build -t punt .
docker run -d \
  -p 3000:3000 \
  -v /var/data/punt:/app/data \
  -e AUTH_SECRET=your-secret \
  -e DATABASE_URL=file:/app/data/punt.db \
  punt
```
