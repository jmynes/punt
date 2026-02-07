---
sidebar_position: 9
---

# Conversational Management (MCP)

PUNT includes an MCP (Model Context Protocol) server that enables conversational ticket management through AI assistants. Instead of clicking through the UI, you can create and manage tickets using natural language.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that allows AI assistants to interact with external tools and data sources. PUNT's MCP server exposes ticket, project, and sprint operations as tools that AI assistants can use.

## Example Interactions

```
You: "What's the status of PUNT-42?"
AI:  PUNT-42: Fix login timeout issue
     Type: bug | Priority: high | Status: In Progress
     Sprint: Sprint 3 | Assignee: Alice
```

```
You: "Create a task to update the documentation"
AI:  Created PUNT-43: Update the documentation
     Type: task | Priority: medium | Status: To Do
```

```
You: "Move PUNT-43 to In Progress and assign it to me"
AI:  Moved PUNT-43: column → In Progress
```

```
You: "Show me all high priority bugs"
AI:  | Key | Title | Status | Assignee |
     |-----|-------|--------|----------|
     | PUNT-12 | Login fails on Safari | In Progress | Bob |
     | PUNT-38 | Data not saving | To Do | - |
```

## Setup

### Prerequisites

- PUNT installed and running
- Node.js 20.9+
- An MCP-compatible client (Claude Desktop, Claude Code, etc.)

### Install Dependencies

```bash
cd /path/to/punt/mcp
pnpm install
```

### Configure Your MCP Client

Add PUNT to your MCP client's configuration. The exact location depends on your client:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "punt": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"],
      "cwd": "/path/to/punt"
    }
  }
}
```

**Claude Code** (`.mcp.json` in your project):

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

### Verify Connection

After configuring, restart your MCP client. You should be able to ask about your tickets:

```
You: "List all projects"
AI:  | Key | Name | Tickets |
     | PUNT | Punt Development | 45 |
```

## Available Operations

### Tickets

| Operation | Example Prompt |
|-----------|----------------|
| Get ticket | "Show me PUNT-42" |
| List tickets | "List all bugs in PUNT" |
| Create ticket | "Create a bug: Login button not working" |
| Update ticket | "Change PUNT-42 priority to high" |
| Move ticket | "Move PUNT-42 to Done" |
| Delete ticket | "Delete PUNT-42" |

### Filtering Tickets

You can filter tickets by various criteria:

```
"Show all high priority tickets"
"List bugs assigned to Alice"
"What tickets are in Sprint 3?"
"Show tickets in the In Progress column"
```

### Projects

| Operation | Example Prompt |
|-----------|----------------|
| List projects | "What projects exist?" |
| Get project | "Show me the PUNT project" |

### Sprints

| Operation | Example Prompt |
|-----------|----------------|
| List sprints | "What sprints are in PUNT?" |
| Get sprint | "Show Sprint 3 with its tickets" |

## Tool Reference

### get_ticket

Get a ticket by its key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key (e.g., "PUNT-2") |

### list_tickets

List tickets with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | No | Filter by project |
| `column` | string | No | Filter by column name |
| `priority` | string | No | Filter by priority |
| `type` | string | No | Filter by type |
| `assignee` | string | No | Filter by assignee name |
| `sprint` | string | No | Filter by sprint name |
| `limit` | number | No | Max results (default: 20) |

### create_ticket

Create a new ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `title` | string | Yes | Ticket title |
| `type` | string | No | epic, story, task, bug, subtask (default: task) |
| `priority` | string | No | lowest, low, medium, high, highest, critical (default: medium) |
| `description` | string | No | Ticket description |
| `column` | string | No | Initial column (default: first column) |
| `assignee` | string | No | Assignee name |
| `storyPoints` | number | No | Story points |

### update_ticket

Update an existing ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `priority` | string | No | New priority |
| `type` | string | No | New type |
| `assignee` | string/null | No | New assignee (null to unassign) |
| `storyPoints` | number/null | No | New story points |

### move_ticket

Move a ticket to a different column or sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key |
| `column` | string | No | Target column name |
| `sprint` | string/null | No | Target sprint (null for backlog) |

### delete_ticket

Delete a ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key |

### list_projects

List all projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 20) |

### get_project

Get project details including columns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Project key |

### list_sprints

List sprints for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `status` | string | No | planning, active, or completed |

### get_sprint

Get sprint details with tickets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name |

## Tips

- **Use natural language**: You don't need to remember exact parameter names. Say "create a high priority bug" instead of specifying `priority: "high"`.
- **Partial matching**: Column, sprint, and assignee names use partial matching. "prog" matches "In Progress".
- **Batch operations**: Describe multiple changes and the AI will make multiple tool calls.
- **Context awareness**: The AI remembers context. After asking about a ticket, you can say "move it to Done" without repeating the ticket key.

## Troubleshooting

### "Failed to connect to punt"

1. Ensure dependencies are installed: `cd mcp && pnpm install`
2. Check the command path in your MCP config
3. Verify PUNT's database exists at `prisma/dev.db`

### "Project not found"

Project keys are case-insensitive but must match exactly. Use `list_projects` to see available projects.

### Changes not appearing in the UI

The MCP server writes directly to the database. Refresh your browser or the changes will appear on the next data fetch.
