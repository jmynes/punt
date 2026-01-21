# PUNT

A self-hosted issue tracker with backlog and Kanban views. Keep your data on your own infrastructure.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)

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
- Dark UI

## Requirements

- Node.js 22+
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

Only enable `TRUST_PROXY` when running behind a trusted reverse proxy.

## Production

```bash
pnpm build
pnpm start
```

## Development

```bash
pnpm dev          # Start dev server
pnpm test         # Run tests
pnpm lint         # Check linting
pnpm db:studio    # Open database browser
```

Pre-commit hooks automatically lint staged files.

## Documentation

- [Testing Guide](docs/TESTING.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Contributor License Agreement](CLA.md)

## Status

PUNT is under active development. The API may change between versions. Mobile responsiveness is a work in progress.

## License

[AGPL-3.0](LICENSE) — If you modify PUNT and run it as a service, you must make your source code available.
