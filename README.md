# PUNT

A self-hosted issue tracker with backlog and Kanban views. Keep your data on your own infrastructure.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)

**[Read the Documentation](https://jmynes.github.io/punt/)**

## Overview

PUNT is a lightweight, local-first issue tracking system for teams who want the essentials without the overhead. It combines a filterable backlog view with a drag-and-drop Kanban board, sprint planning, and real-time sync across browser tabs.

**Key capabilities:**

- Backlog with filtering, sorting, bulk actions, and **PQL query language**
- Kanban board with drag-and-drop, column customization (icons, colors)
- Sprint planning with carryover tracking
- Ticket linking (blocks, relates to, duplicates)
- Granular permissions with custom roles
- Multi-select operations via keyboard or context menu
- Undo/redo for moves, updates, and deletions
- Real-time sync via Server-Sent Events
- File attachments with configurable limits
- Custom branding (logo, app name, colors)
- Email system (password reset, verification, invitations)
- **Conversational ticket management via MCP** -- Create and manage tickets through natural language
- Dark UI

## Try the Demo

**[Live Demo](https://punt-demo-production.up.railway.app)** -- No account required. Data is stored in your browser's localStorage.

## Requirements

- **Node.js** 20.9+ (enforced in `package.json`)
- **pnpm** 9+
- **PostgreSQL** 16+ (not required for demo mode)

**Recommended for MCP / Claude Code workflow:**
- [GitHub CLI (`gh`)](https://cli.github.com/) -- for PR creation, merging, and issue management from the terminal

## Quick Start (Full Mode)

This is the standard setup for development and production. If you just want to try the interface without a database, see [Demo Mode](#demo-mode) below.

### 1. Install PostgreSQL

If you do not already have PostgreSQL installed locally:

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-16
sudo systemctl start postgresql
```

**Fedora:**
```bash
sudo dnf install postgresql-server postgresql
sudo postgresql-setup --initdb
sudo systemctl start postgresql
```

**Windows:**
Download the installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).

### 2. Create the database

```bash
# Connect as the postgres superuser (may require sudo on Linux)
sudo -u postgres psql

# Inside psql, create a user and database:
CREATE USER punt WITH PASSWORD 'punt';
CREATE DATABASE punt OWNER punt;
\q
```

This gives you the connection string: `postgresql://punt:punt@localhost:5432/punt`

If your PostgreSQL is configured differently (different port, host, or auth method), adjust the `DATABASE_URL` accordingly.

### 3. Clone and install

```bash
git clone https://github.com/jmynes/punt.git
cd punt
pnpm install
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

```bash
# Database connection (update if your credentials differ from step 2)
DATABASE_URL="postgresql://punt:punt@localhost:5432/punt"

# Auth secret -- REQUIRED. Generate one with:
#   openssl rand -base64 32
AUTH_SECRET="paste-your-generated-secret-here"
```

See [Configuration](#configuration) for all available environment variables.

### 5. Set up the database schema

```bash
# Generate the Prisma client (TypeScript types from the schema)
pnpm db:generate

# Push the schema to your PostgreSQL database (creates all tables)
pnpm db:push
```

> **When to use which command:**
> - `pnpm db:generate` -- Run after cloning or after any change to `prisma/schema.prisma`. Generates the TypeScript client in `src/generated/prisma/`.
> - `pnpm db:push` -- Syncs the schema to the database. Use during development to quickly apply schema changes. Also creates performance indexes.
> - `pnpm db:migrate` -- Creates a versioned migration file and applies it. Use when you need a migration history (e.g., for production deployments).

### 6. Create the first admin user

```bash
pnpm db:seed --username admin --password "YourSecurePass1" --name "Admin"
```

Password requirements: minimum 12 characters, at least one uppercase letter, one lowercase letter, and one number.

You can optionally pass `--email admin@example.com`.

### 7. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials from step 6.

> **Note:** `pnpm dev` automatically checks for out-of-date dependencies and regenerates the Prisma client if the schema has changed, so you rarely need to run `pnpm db:generate` manually during day-to-day development.

## Demo Mode

Demo mode runs the app entirely client-side with no database required. All data is stored in the browser's localStorage.

```bash
git clone https://github.com/jmynes/punt.git
cd punt
pnpm install

# Create a minimal .env for demo mode
cat > .env <<EOF
NEXT_PUBLIC_DEMO_MODE=true
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_TRUST_HOST=true
EOF

# Generate the Prisma client (still needed for type imports)
pnpm db:generate

# Start the server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) -- you are automatically signed in as a demo user.

## Configuration

All configuration is done through environment variables in `.env`. See `.env.example` for the full template.

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (not needed in demo mode) |
| `AUTH_SECRET` | Secret for JWT signing. Generate with `openssl rand -base64 32` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_TRUST_HOST` | Trust the host header (set `true` behind a reverse proxy or with `pnpm start`) | _not set_ |
| `NEXTAUTH_URL` | Canonical app URL in production (e.g., `https://punt.example.com`) | _auto-detected_ |
| `TRUST_PROXY` | Trust `X-Forwarded-For` for rate limiting (only behind a trusted proxy) | `false` |
| `NEXT_PUBLIC_DEBUG` | Enable debug logging in the browser console | `false` |
| `NEXT_PUBLIC_DEMO_MODE` | Run in demo mode (no database) | `false` |
| `EMAIL_RESEND_API_KEY` | API key for [Resend](https://resend.com) email provider | _not set_ |
| `EMAIL_SMTP_PASSWORD` | Password for SMTP email provider | _not set_ |

> **Warning:** Only enable `TRUST_PROXY` when running behind a trusted reverse proxy. Setting it to `true` without one allows rate limiting to be bypassed.

### `.env` vs `.env.local`

Next.js supports both `.env` and `.env.local` files. For PUNT:
- **`.env`** -- Main configuration file. Copy from `.env.example` and edit.
- **`.env.local`** -- Optional override file (gitignored by Next.js). Useful for personal settings that differ from the team's `.env`.
- **`.env.test`** -- Loaded automatically by Vitest for the test environment. Points to a separate `punt_test` database.

In most cases, `.env` is all you need.

## Production

```bash
pnpm build
pnpm start
```

Set `AUTH_TRUST_HOST=true` when running with `pnpm start` or behind a reverse proxy.

### Railway Deployment

A `railway.toml` is included for easy deployment to [Railway](https://railway.app):

```bash
railway link
railway variables --set "AUTH_SECRET=$(openssl rand -base64 32)"
railway variables --set "AUTH_TRUST_HOST=true"
railway variables --set "DATABASE_URL=<your-postgresql-url>"
railway up
railway domain
```

For a demo-only deployment (no database), also set:
```bash
railway variables --set "NEXT_PUBLIC_DEMO_MODE=true"
```

## Development

```bash
pnpm dev          # Start dev server (Turbopack, port 3000)
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Check linting (Biome)
pnpm lint:fix     # Auto-fix lint issues
pnpm db:studio    # Open Prisma Studio (visual database browser)
```

Pre-commit hooks (husky + lint-staged) automatically lint staged files before each commit.

### Testing with a Separate Database

Tests use a separate database to avoid interfering with development data. The connection string is configured in `.env.test`:

```
DATABASE_URL="postgresql://punt:punt@localhost:5432/punt_test"
```

Create the test database the same way as the main one:
```bash
sudo -u postgres psql -c "CREATE DATABASE punt_test OWNER punt;"
```

Then push the schema:
```bash
DATABASE_URL="postgresql://punt:punt@localhost:5432/punt_test" pnpm db:push
```

See [docs/TESTING.md](docs/TESTING.md) for the full testing guide.

## Conversational Ticket Management (MCP)

PUNT includes an [MCP server](https://modelcontextprotocol.io/) that enables conversational ticket management through AI assistants like Claude. Changes appear instantly in the UI via real-time SSE updates.

```
You: "Create a bug ticket for the login page not loading"
AI:  Created PUNT-42: Login page not loading
     Type: bug | Priority: medium | Status: To Do
```

### Setup

1. Install dependencies:
   ```bash
   cd mcp && pnpm install
   ```

2. Generate your API key in the PUNT web UI:
   - Go to **Profile > Integrations**
   - Click **Generate Key** under MCP API Key
   - Copy the key (it won't be shown again)

3. Save your credentials to the config directory for your platform:

   | Platform | Path |
   |----------|------|
   | Linux | `~/.config/punt/credentials.json` |
   | macOS | `~/Library/Application Support/punt/credentials.json` |
   | Windows | `%APPDATA%\punt\credentials.json` |

   ```json
   {
     "servers": {
       "default": {
         "url": "http://localhost:3000",
         "apiKey": "mcp_your-key-here"
       }
     },
     "activeServer": "default"
   }
   ```

4. Add MCP server config to your client:

   For **Claude Code**, add `.mcp.json` in the project root:
   ```json
   {
     "mcpServers": {
       "punt": {
         "type": "stdio",
         "command": "pnpm",
         "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"]
       }
     }
   }
   ```

   For **Claude Desktop**, add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "punt": {
         "type": "stdio",
         "command": "pnpm",
         "args": ["--dir", "/path/to/punt/mcp", "exec", "tsx", "src/index.ts"]
       }
     }
   }
   ```

   > **Note:** Credentials are stored in your user config directory, not in the MCP config file.

### Available Operations

- **Tickets**: get, list, create, update, move, delete
- **Projects**: list, get, create, update, delete
- **Sprints**: list, get, create, update, start, complete, delete
- **Members**: list, add, remove, change role
- **Labels**: list, create, update, delete, add/remove from tickets
- **Columns**: list, create, rename, reorder, delete

See the [MCP documentation](https://jmynes.github.io/punt/user-guide/mcp) for detailed usage.

## Documentation

- [User Guide & API Reference](https://jmynes.github.io/punt/) -- Full documentation
- [Testing Guide](docs/TESTING.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Contributor License Agreement](CLA.md)

## Status

PUNT is under active development. The API may change between versions. Mobile responsiveness is a work in progress.

## License

[AGPL-3.0](LICENSE) -- If you modify PUNT and run it as a service, you must make your source code available.
