# PUNT

A self-hosted issue tracker with backlog and Kanban views. Keep your data on your own infrastructure.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)

## Features

- Kanban board with drag-and-drop and customizable columns
- Filterable backlog with bulk actions and PQL query language
- Sprint planning with carryover tracking
- Ticket linking, file attachments, and custom branding
- Granular permissions with custom roles
- Real-time multi-user sync via Server-Sent Events
- Conversational ticket management via MCP
- Dark UI

**[Live Demo](https://punt-demo-production.up.railway.app)** -- No account required.

## Quick Start

**Requirements:** Node.js 20.9+, pnpm 9+, PostgreSQL 16+ (not required for demo mode)

```bash
git clone https://github.com/jmynes/punt.git
cd punt
pnpm install
pnpm run setup
```

The guided installer walks you through PostgreSQL setup, environment configuration, and admin user creation. It also offers a demo mode that skips the database entirely.

> **Note:** `pnpm setup` is a built-in pnpm command. Always use `pnpm run setup`.

After setup completes:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials you created.

**Recommended for MCP / Claude Code workflow:**
- [GitHub CLI (`gh`)](https://cli.github.com/) -- for PR creation, merging, and issue management from the terminal

## Documentation

Full documentation is available at **[jmynes.github.io/punt](https://jmynes.github.io/punt/)**:

- [Getting Started](https://jmynes.github.io/punt/) -- Installation, configuration, environment variables
- [Self-Hosted Deployment](https://jmynes.github.io/punt/deployment/self-hosted) -- Production setup, reverse proxy, backups
- [Railway Deployment](https://jmynes.github.io/punt/deployment/railway) -- One-click cloud deployment
- [MCP Integration](https://jmynes.github.io/punt/user-guide/mcp) -- Conversational ticket management with AI assistants
- [Testing Guide](docs/TESTING.md) -- Running tests, database isolation
- [API Reference](https://jmynes.github.io/punt/api-reference/overview) -- REST API documentation

## Development

```bash
pnpm dev          # Start dev server (Turbopack, port 3000)
pnpm test         # Run tests
pnpm lint         # Check linting (Biome)
pnpm db:studio    # Visual database browser
```

See the [development docs](docs/DEVELOPMENT.md) for the full command reference.

## Contributing

- [Contributing Guidelines](CONTRIBUTING.md)
- [Contributor License Agreement](CLA.md)

## License

[AGPL-3.0](LICENSE) -- If you modify PUNT and run it as a service, you must make your source code available.
