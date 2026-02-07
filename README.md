# PUNT

A self-hosted issue tracker with backlog and Kanban views. Keep your data on your own infrastructure.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)

**[Read the Documentation](https://jmynes.github.io/punt/)**

## Overview

PUNT is a lightweight, local-first issue tracking system for teams who want the essentials without the overhead. It combines a filterable backlog view with a drag-and-drop Kanban board, sprint planning, and real-time sync across browser tabs.

**Key capabilities:**

- Backlog with filtering, sorting, and bulk actions
- Kanban board with drag-and-drop
- Sprint planning with carryover tracking
- Multi-select operations via keyboard or context menu
- Undo/redo for moves, updates, and deletions
- Real-time sync via Server-Sent Events
- Role-based project access (owner, admin, member)
- File attachments with configurable limits
- **Conversational ticket management via MCP** — Create and manage tickets through natural language
- Dark UI

## Try the Demo

**[Live Demo](https://punt-demo-production.up.railway.app)** — No account required. Data is stored in your browser's localStorage.

## Requirements

- Node.js 20.9+
- pnpm 9+

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/punt.git
cd punt
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and set AUTH_SECRET (generate with: openssl rand -base64 32)

# Set up database
pnpm db:generate
pnpm db:push

# Create admin user
pnpm db:seed --username admin --password "YourPassword123" --name "Admin"

# Start server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path (relative to `prisma/`) | `file:./punt.db` |
| `AUTH_SECRET` | Secret for JWT signing | Required |
| `TRUST_PROXY` | Trust `X-Forwarded-For` for rate limiting | `false` |
| `NEXT_PUBLIC_DEBUG` | Enable debug logging | `false` |
| `NEXT_PUBLIC_DEMO_MODE` | Run in demo mode (no database) | `false` |

Only enable `TRUST_PROXY` when running behind a trusted reverse proxy.

### Demo Mode

Set `NEXT_PUBLIC_DEMO_MODE=true` to run without a database. All data is stored in the browser's localStorage. Useful for demos and trying out the interface.

## Production

```bash
pnpm build
pnpm start
```

### Railway Deployment

A `railway.toml` is included for easy deployment to [Railway](https://railway.app):

```bash
railway link
railway variables --set "NEXT_PUBLIC_DEMO_MODE=true"
railway variables --set "AUTH_SECRET=$(openssl rand -base64 32)"
railway variables --set "AUTH_TRUST_HOST=true"
railway variables --set "DATABASE_URL=file:./dummy.db"  # Required for build
railway up
railway domain
```

## Development

```bash
pnpm dev          # Start dev server
pnpm test         # Run tests
pnpm lint         # Check linting
pnpm db:studio    # Open database browser
```

Pre-commit hooks automatically lint staged files.

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

2. Generate your API key (requires PUNT to be running):
   ```bash
   # Log in to PUNT web UI, then:
   curl -X POST http://localhost:3000/api/me/mcp-key \
     -H "Cookie: authjs.session-token=YOUR_SESSION_COOKIE"
   # Save the returned apiKey - it won't be shown again
   ```

3. Add to your MCP client config (e.g., Claude Desktop):
   ```json
   {
     "mcpServers": {
       "punt": {
         "type": "stdio",
         "command": "pnpm",
         "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"],
         "cwd": "/path/to/punt",
         "env": {
           "MCP_API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

### Available Operations

- **Tickets**: get, list, create, update, move, delete
- **Projects**: list, get, create, update, delete
- **Sprints**: list, get, create, update, start, complete, delete
- **Members**: list, add, remove, change role
- **Labels**: list, create, update, delete, add/remove from tickets
- **Columns**: list, create, rename, reorder, delete

See the [MCP documentation](https://jmynes.github.io/punt/user-guide/mcp) for detailed usage.

## Documentation

- [User Guide & API Reference](https://jmynes.github.io/punt/) — Full documentation
- [Testing Guide](docs/TESTING.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Contributor License Agreement](CLA.md)

## Status

PUNT is under active development. The API may change between versions. Mobile responsiveness is a work in progress.

## License

[AGPL-3.0](LICENSE) — If you modify PUNT and run it as a service, you must make your source code available.
