---
sidebar_position: 9
---

# Conversational Management (MCP)

PUNT includes an MCP (Model Context Protocol) server that enables conversational ticket management through AI assistants. Instead of clicking through the UI, you can create and manage tickets using natural language.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that allows AI assistants to interact with external tools and data sources. PUNT's MCP server exposes full CRUD operations for tickets, projects, sprints, members, labels, and columns.

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
You: "Create a new project called Mobile App with key MOBILE"
AI:  Created project MOBILE: Mobile App
```

```
You: "Start Sprint 3 with a 2-week duration"
AI:  Started sprint "Sprint 3" with 12 tickets
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

### Generate Your API Key

Each user needs their own API key to authenticate MCP requests. The key ties MCP actions to your user account.

1. Log in to PUNT in your web browser
2. Generate a key using the API:
   ```bash
   curl -X POST http://localhost:3000/api/me/mcp-key \
     -H "Cookie: authjs.session-token=YOUR_SESSION_COOKIE"
   ```
3. Save the returned `apiKey` — it will only be shown once

To revoke your key: `DELETE /api/me/mcp-key`
To check if you have a key: `GET /api/me/mcp-key`

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
      "cwd": "/path/to/punt",
      "env": {
        "MCP_API_KEY": "your-api-key-here"
      }
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
      "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "MCP_API_KEY": "your-api-key-here"
      }
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

### Projects

| Operation | Example Prompt |
|-----------|----------------|
| List projects | "What projects exist?" |
| Get project | "Show me the PUNT project" |
| Create project | "Create a project called Mobile App with key MOBILE" |
| Update project | "Change PUNT description to 'Issue tracker'" |
| Delete project | "Delete the MOBILE project" |

### Sprints

| Operation | Example Prompt |
|-----------|----------------|
| List sprints | "What sprints are in PUNT?" |
| Get sprint | "Show Sprint 3 with its tickets" |
| Create sprint | "Create Sprint 4 with goal 'Bug fixes'" |
| Update sprint | "Change Sprint 4 end date to next Friday" |
| Start sprint | "Start Sprint 4" |
| Complete sprint | "Complete Sprint 3, move incomplete to backlog" |
| Delete sprint | "Delete Sprint 4" |

### Members

| Operation | Example Prompt |
|-----------|----------------|
| List members | "Who is on the PUNT project?" |
| Add member | "Add Alice to PUNT as Admin" |
| Remove member | "Remove Bob from PUNT" |
| Change role | "Make Alice an Owner of PUNT" |
| List users | "Show all users in the system" |

### Labels

| Operation | Example Prompt |
|-----------|----------------|
| List labels | "What labels exist in PUNT?" |
| Create label | "Create a 'security' label in PUNT" |
| Update label | "Change the bug label color to red" |
| Delete label | "Delete the deprecated label" |
| Add to ticket | "Add the security label to PUNT-42" |
| Remove from ticket | "Remove the bug label from PUNT-42" |

### Columns

| Operation | Example Prompt |
|-----------|----------------|
| List columns | "What columns are in PUNT?" |
| Create column | "Add a 'Testing' column after In Review" |
| Rename column | "Rename 'To Do' to 'Backlog'" |
| Reorder column | "Move Testing to position 3" |
| Delete column | "Delete the Testing column, move tickets to In Review" |

## Tool Reference

### Ticket Tools

#### get_ticket

Get a ticket by its key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key (e.g., "PUNT-2") |

#### list_tickets

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

#### create_ticket

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
| `labels` | string[] | No | Label names to assign |
| `sprint` | string | No | Sprint name |
| `parent` | string | No | Parent ticket key (for subtasks) |
| `estimate` | string | No | Time estimate (e.g., "2h", "1d") |
| `startDate` | string | No | Start date (ISO format) |
| `dueDate` | string | No | Due date (ISO format) |
| `environment` | string | No | Environment (e.g., "production") |
| `affectedVersion` | string | No | Affected version |
| `fixVersion` | string | No | Fix version |

#### update_ticket

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
| `labels` | string[] | No | Label names (replaces existing) |
| `sprint` | string/null | No | Sprint name (null for backlog) |
| `parent` | string/null | No | Parent ticket key |
| `estimate` | string/null | No | Time estimate |
| `startDate` | string/null | No | Start date |
| `dueDate` | string/null | No | Due date |
| `environment` | string/null | No | Environment |
| `affectedVersion` | string/null | No | Affected version |
| `fixVersion` | string/null | No | Fix version |

#### move_ticket

Move a ticket to a different column or sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key |
| `column` | string | No | Target column name |
| `sprint` | string/null | No | Target sprint (null for backlog) |

#### delete_ticket

Delete a ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Ticket key |

### Project Tools

#### list_projects

List all projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 20) |

#### get_project

Get project details including columns and members.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Project key |

#### create_project

Create a new project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `key` | string | Yes | Project key (2-10 uppercase letters/numbers) |
| `description` | string | No | Project description |
| `color` | string | No | Project color (hex, e.g., #3b82f6) |

#### update_project

Update a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Project key |
| `name` | string | No | New project name |
| `description` | string/null | No | New description (null to clear) |
| `color` | string | No | New color (hex) |

#### delete_project

Delete a project and all its data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Project key |
| `confirm` | boolean | Yes | Must be true to confirm deletion |

### Sprint Tools

#### list_sprints

List sprints for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `status` | string | No | planning, active, or completed |

#### get_sprint

Get sprint details with tickets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name |

#### create_sprint

Create a new sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `name` | string | Yes | Sprint name |
| `goal` | string | No | Sprint goal |
| `startDate` | string | No | Start date (ISO format) |
| `endDate` | string | No | End date (ISO format) |
| `budget` | number | No | Story points capacity |

#### update_sprint

Update a sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name to update |
| `name` | string | No | New sprint name |
| `goal` | string/null | No | New goal (null to clear) |
| `startDate` | string/null | No | New start date |
| `endDate` | string/null | No | New end date |
| `budget` | number/null | No | New capacity |

#### start_sprint

Start a planning sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name to start |
| `startDate` | string | No | Start date (defaults to today) |
| `endDate` | string | No | End date |

#### complete_sprint

Complete an active sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name to complete |
| `moveIncompleteTo` | string | No | "backlog" or "next" (default: backlog) |

#### delete_sprint

Delete a sprint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `sprintName` | string | Yes | Sprint name to delete |
| `confirm` | boolean | Yes | Must be true to confirm deletion |

### Member Tools

#### list_members

List members of a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |

#### add_member

Add a user to a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `userName` | string | Yes | User name to add |
| `role` | string | No | Role name (default: Member) |

#### remove_member

Remove a user from a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `userName` | string | Yes | User name to remove |

#### change_member_role

Change a member's role.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `userName` | string | Yes | User name |
| `role` | string | Yes | New role name |

#### list_users

List all users in the system.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 50) |

### Label Tools

#### list_labels

List all labels for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |

#### create_label

Create a new label.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `name` | string | Yes | Label name |
| `color` | string | No | Label color (hex) |

#### update_label

Update a label.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `labelName` | string | Yes | Current label name |
| `name` | string | No | New label name |
| `color` | string | No | New color (hex) |

#### delete_label

Delete a label.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `labelName` | string | Yes | Label name to delete |

#### add_label_to_ticket

Add a label to a ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticketKey` | string | Yes | Ticket key (e.g., PUNT-42) |
| `labelName` | string | Yes | Label name to add |

#### remove_label_from_ticket

Remove a label from a ticket.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticketKey` | string | Yes | Ticket key (e.g., PUNT-42) |
| `labelName` | string | Yes | Label name to remove |

### Column Tools

#### list_columns

List all columns for a project.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |

#### create_column

Create a new column.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `name` | string | Yes | Column name |
| `position` | number | No | Position (1-based, defaults to end) |

#### rename_column

Rename a column.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `columnName` | string | Yes | Current column name |
| `newName` | string | Yes | New column name |

#### reorder_column

Move a column to a new position.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `columnName` | string | Yes | Column name to move |
| `position` | number | Yes | New position (1-based) |

#### delete_column

Delete a column (moves tickets to another column).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | Yes | Project key |
| `columnName` | string | Yes | Column name to delete |
| `moveTicketsTo` | string | Yes | Column to move tickets to |

## Tips

- **Use natural language**: You don't need to remember exact parameter names. Say "create a high priority bug" instead of specifying `priority: "high"`.
- **Partial matching**: Column, sprint, label, and assignee names use partial matching. "prog" matches "In Progress".
- **Batch operations**: Describe multiple changes and the AI will make multiple tool calls.
- **Context awareness**: The AI remembers context. After asking about a ticket, you can say "move it to Done" without repeating the ticket key.

## Troubleshooting

### "Failed to connect to punt"

1. Ensure dependencies are installed: `cd mcp && pnpm install`
2. Check the command path in your MCP config
3. Verify PUNT is running at the configured `MCP_BASE_URL` (default: `http://localhost:3000`)

### "Unauthorized" or "Invalid API key"

1. Ensure `MCP_API_KEY` is set in your MCP config's `env` section
2. Verify the key was generated via `POST /api/me/mcp-key`
3. Check that your user account is still active

### "Project not found"

Project keys are case-insensitive but must match exactly. Use `list_projects` to see available projects.

### Real-time Updates

MCP changes appear instantly in the PUNT web UI via Server-Sent Events (SSE). If updates aren't appearing:
1. Check the browser console for SSE connection errors
2. Verify the PUNT dev server is running
3. Try refreshing the page to re-establish the SSE connection
