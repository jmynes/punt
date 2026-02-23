# PUNT MCP Server

MCP (Model Context Protocol) server for conversational ticket management with PUNT.

## Overview

The MCP server enables AI assistants like Claude to manage tickets, projects, sprints, and more through natural language. It calls PUNT's API endpoints (not direct database access), ensuring:

- **Real-time SSE updates**: Changes made via MCP appear instantly in the UI without refresh
- **Per-user authentication**: Each user generates their own API key
- **Consistent permissions**: MCP requests use the same authorization as the web UI

## Quick Start

```bash
# Install dependencies (first time only)
cd mcp && pnpm install

# Run the server
pnpm --dir mcp exec tsx src/index.ts
```

## Authentication

1. Generate an API key in the PUNT web UI: **Profile > MCP API Key**
2. Store the key in your credentials file (see [Credentials Configuration](#credentials-configuration))
3. The MCP server sends the key via `X-MCP-API-Key` header
4. API routes validate the key via `getMcpUser()` in `auth-helpers.ts`

## Available Tools (44 total)

| Category | Tools |
|----------|-------|
| Tickets | `get_ticket`, `list_tickets`, `create_ticket`, `update_ticket`, `move_ticket`, `delete_ticket`, `search_tickets` |
| Comments | `list_comments`, `add_comment`, `update_comment`, `delete_comment` |
| Ticket Links | `list_ticket_links`, `add_ticket_link`, `remove_ticket_link` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Sprints | `list_sprints`, `get_sprint`, `create_sprint`, `update_sprint`, `start_sprint`, `complete_sprint`, `delete_sprint` |
| Members | `list_members`, `add_member`, `remove_member`, `change_member_role`, `list_users` |
| Labels | `list_labels`, `create_label`, `update_label`, `delete_label`, `add_label_to_ticket`, `remove_label_from_ticket` |
| Columns | `list_columns`, `create_column`, `rename_column`, `reorder_column`, `delete_column` |
| Repository | `get_repo_context`, `get_branch_name` |

## Querying Conventions

When using the MCP server, follow these conventions:

- **All tickets are in scope by default.** Do not assume only "To Do", backlog, or active sprint unless the user explicitly scopes the query (e.g. "in the current sprint", "in the backlog", "To Do tickets only").
- When applying filters, state which filters were used so the user knows what was included/excluded.
- When auditing or reviewing tickets (e.g. checking for missing fields, evaluating points), query all columns and statuses — not just To Do.
- Use your best judgement to scope queries when context makes it obvious (e.g. "what's left to do" implies non-Done tickets), but be transparent about it.

## Credentials Configuration

Store MCP credentials in your user config directory:

| Platform | Path |
|----------|------|
| Linux | `~/.config/punt/credentials.json` (or `$XDG_CONFIG_HOME/punt/`) |
| macOS | `~/Library/Application Support/punt/credentials.json` |
| Windows | `%APPDATA%\punt\credentials.json` |

### Credentials File Format

```json
{
  "servers": {
    "default": {
      "url": "https://punt.example.com",
      "apiKey": "mcp_xxxxx..."
    },
    "local": {
      "url": "http://localhost:3000",
      "apiKey": "mcp_yyyyy..."
    }
  },
  "activeServer": "default"
}
```

This supports:
- **Multiple PUNT servers**: Work, personal, local dev environments
- **Named server profiles**: Switch between servers via `PUNT_SERVER` env var
- **Hot-reload**: Credentials are re-read every 5 seconds (no restart needed)

### Resolution Priority

1. `PUNT_API_KEY` + `PUNT_API_URL` env vars (CI/automation)
2. `PUNT_SERVER` env var → lookup named server in credentials.json
3. `activeServer` from credentials.json
4. Fallback to "default" server

## Claude Code Configuration

Create `.mcp.json` in your project root (gitignored):

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

For CI/automation, override with environment variables:

```json
{
  "mcpServers": {
    "punt": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "PUNT_API_KEY": "$MCP_API_KEY",
        "PUNT_API_URL": "https://punt.example.com"
      }
    }
  }
}
```

## Prerequisites

For full workflow support:
- PUNT server running (local `pnpm dev` or remote)
- Credentials configured in user config directory
- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated — used for PR creation, merging, and issue management
- Git configured for the repository

## Repository Integration

The MCP server supports per-project repository configuration for AI agent context.

### MCP Tools

- `get_repo_context` - Get full repository context including URL, paths, branch template, environment branches, and agent guidance. Optionally pass a ticket number to get a suggested branch name.
- `get_branch_name` - Generate a branch name for a specific ticket using the project's branch template.

### Branch Template Variables

- `{type}` - Ticket type mapped to conventional commit prefix (bug→fix, story→feat, task→chore)
- `{key}` - Full ticket key (e.g., PUNT-42)
- `{number}` - Ticket number only (e.g., 42)
- `{slug}` - Slugified ticket title
- `{project}` - Project key lowercase

Configure repository settings in the PUNT web UI: **Project Settings > Repository Tab**

## Parallel Subagents

When launching multiple Claude Code subagents in parallel, each must work in its own git worktree to avoid branch-switching conflicts:

```bash
git worktree add /tmp/worktree-<branch-name> -b <branch-name> main
cd /tmp/worktree-<branch-name>
# Do all work here, then commit, push, and create PR from this directory
```

Without worktrees, agents overwrite each other's file changes and cause linter/commit failures.

## Code Conventions

- **Use `??` (nullish coalescing), not `||`:** For values where `0`, `false`, or empty string are valid, always use `??`. Example: `storyPoints ?? null` not `storyPoints || null` (the latter silently discards `0`).

## Project Structure

```
mcp/
├── src/
│   ├── index.ts          # Server entry point, tool registrations
│   ├── api-client.ts     # HTTP client for PUNT API calls
│   ├── config.ts         # Cross-platform config directory resolution
│   ├── credentials.ts    # Credential file reading and server resolution
│   ├── utils.ts          # Formatting helpers (markdown output)
│   └── tools/
│       ├── tickets.ts    # Ticket CRUD tools
│       ├── projects.ts   # Project/member/column tools
│       ├── sprints.ts    # Sprint lifecycle tools
│       ├── labels.ts     # Label management tools
│       └── repository.ts # Repository context and branch name tools
└── package.json
```

## API Endpoint

The MCP server communicates with PUNT via the standard REST API. Authentication is handled via the `X-MCP-API-Key` header, validated by `getMcpUser()` in `src/lib/auth-helpers.ts`.
