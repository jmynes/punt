---
sidebar_position: 3
---

# Projects API

Endpoints for managing projects and project members.

## List Projects

Get all projects the authenticated user has access to.

```http
GET /api/projects
```

### Response

```json
[
  {
    "id": "clx1abc123",
    "name": "My Project",
    "key": "PROJ",
    "description": "Project description",
    "color": "#3B82F6",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Create Project

Create a new project.

```http
POST /api/projects
```

### Request Body

```json
{
  "name": "My Project",
  "key": "PROJ",
  "description": "Project description",
  "color": "#3B82F6"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project display name |
| `key` | string | Yes | Unique project key (2-10 chars, uppercase) |
| `description` | string | No | Project description |
| `color` | string | No | Hex color code (default: auto-assigned) |

### Response

```json
{
  "id": "clx1abc123",
  "name": "My Project",
  "key": "PROJ",
  "description": "Project description",
  "color": "#3B82F6",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

The creating user is automatically assigned as the project owner.

## Get Project

Get a specific project by ID.

```http
GET /api/projects/[projectId]
```

### Response

```json
{
  "id": "clx1abc123",
  "name": "My Project",
  "key": "PROJ",
  "description": "Project description",
  "color": "#3B82F6",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Required Role**: Project member

## Update Project

Update project details.

```http
PATCH /api/projects/[projectId]
```

### Request Body

```json
{
  "name": "Updated Project Name",
  "description": "New description",
  "color": "#EF4444"
}
```

**Required Role**: Project admin or owner

:::note
The project key cannot be changed after creation.
:::

## Delete Project

Permanently delete a project and all associated data.

```http
DELETE /api/projects/[projectId]
```

**Required Role**: Project owner only

:::danger
This action is irreversible. All tickets, sprints, and history will be deleted.
:::

## Project Columns

### List Columns

Get all columns for a project's board.

```http
GET /api/projects/[projectId]/columns
```

### Response

```json
[
  {
    "id": "clx1col1",
    "name": "To Do",
    "order": 0
  },
  {
    "id": "clx1col2",
    "name": "In Progress",
    "order": 1
  },
  {
    "id": "clx1col3",
    "name": "Done",
    "order": 2
  }
]
```

If no columns exist, default columns (To Do, In Progress, Done) are automatically created.

## Project Members

### List Members

Get all members of a project.

```http
GET /api/projects/[projectId]/members
```

### Response

```json
[
  {
    "id": "clx1mem1",
    "userId": "clx1user1",
    "projectId": "clx1abc123",
    "role": "owner",
    "user": {
      "id": "clx1user1",
      "username": "johndoe",
      "name": "John Doe",
      "avatar": "/uploads/avatars/abc.webp"
    }
  },
  {
    "id": "clx1mem2",
    "userId": "clx1user2",
    "projectId": "clx1abc123",
    "role": "member",
    "user": {
      "id": "clx1user2",
      "username": "janedoe",
      "name": "Jane Doe",
      "avatar": null
    }
  }
]
```

### Member Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full control, delete project, manage all members |
| `admin` | Update project, manage members (except owner) |
| `member` | View and edit tickets, sprints, labels |

## Project Labels

### List Labels

```http
GET /api/projects/[projectId]/labels
```

### Response

```json
[
  {
    "id": "clx1lbl1",
    "name": "bug",
    "color": "#EF4444"
  },
  {
    "id": "clx1lbl2",
    "name": "feature",
    "color": "#22C55E"
  }
]
```

### Create Label

```http
POST /api/projects/[projectId]/labels
```

### Request Body

```json
{
  "name": "documentation",
  "color": "#3B82F6"
}
```

If `color` is not provided, a color is automatically assigned.

### Delete Label

```http
DELETE /api/projects/[projectId]/labels/[labelId]
```

## Real-time Events

Subscribe to project events via Server-Sent Events:

```http
GET /api/projects/[projectId]/events
```

### Event Types

| Event | Description |
|-------|-------------|
| `ticket.created` | New ticket created |
| `ticket.updated` | Ticket fields changed |
| `ticket.moved` | Ticket moved between columns |
| `ticket.deleted` | Ticket deleted |
| `label.created` | New label created |
| `label.deleted` | Label deleted |

### Event Format

```json
{
  "type": "ticket.created",
  "data": {
    "id": "clx1tkt1",
    "title": "New ticket",
    "type": "Task"
  },
  "tabId": "abc123"
}
```

The `tabId` field identifies the originating browser tab to prevent event echoing.
