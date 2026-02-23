---
sidebar_position: 4
---

# Tickets API

Endpoints for managing tickets within projects.

## List Tickets

Get all tickets in a project.

```http
GET /api/projects/[projectId]/tickets
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sprintId` | string | Filter by sprint ID |
| `columnId` | string | Filter by column/status |
| `type` | string | Filter by type (Story, Bug, Task, etc.) |
| `priority` | string | Filter by priority |
| `assigneeId` | string | Filter by assignee |

### Response

```json
[
  {
    "id": "clx1tkt1",
    "number": 1,
    "title": "Implement login page",
    "description": "Create the login form with validation",
    "type": "Story",
    "priority": "High",
    "order": 0,
    "columnId": "clx1col1",
    "assigneeId": "clx1user1",
    "sprintId": "clx1spr1",
    "storyPoints": 5,
    "projectId": "clx1abc123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Create Ticket

Create a new ticket in a project.

```http
POST /api/projects/[projectId]/tickets
```

### Request Body

```json
{
  "title": "Implement login page",
  "description": "Create the login form with validation",
  "type": "Story",
  "priority": "High",
  "columnId": "clx1col1",
  "assigneeId": "clx1user1",
  "sprintId": "clx1spr1",
  "storyPoints": 5,
  "estimate": "4h",
  "startDate": "2024-01-16",
  "dueDate": "2024-01-20",
  "labelIds": ["clx1lbl1", "clx1lbl2"]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Ticket title (required) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Detailed description (Markdown) |
| `type` | string | Story, Bug, Task, Subtask, Epic |
| `priority` | string | Critical, High, Medium, Low |
| `columnId` | string | Board column ID |
| `assigneeId` | string | Assigned user ID |
| `sprintId` | string | Sprint ID |
| `parentId` | string | Parent ticket ID (for subtasks) |
| `storyPoints` | number | Effort estimation (1, 2, 3, 5, 8, 13, 21) |
| `estimate` | string | Time estimate (e.g., "2h", "1d") |
| `startDate` | string | Start date (ISO format) |
| `dueDate` | string | Due date (ISO format) |
| `environment` | string | Environment (Production, Staging, etc.) |
| `affectedVersion` | string | Version where issue found |
| `fixVersion` | string | Target fix version |
| `labelIds` | string[] | Array of label IDs |
| `watcherIds` | string[] | Array of user IDs to watch |

### Response

```json
{
  "id": "clx1tkt1",
  "number": 42,
  "title": "Implement login page",
  "key": "PROJ-42",
  ...
}
```

## Get Ticket

Get a specific ticket.

```http
GET /api/projects/[projectId]/tickets/[ticketId]
```

### Response

Returns the full ticket with all relationships:

```json
{
  "id": "clx1tkt1",
  "number": 42,
  "title": "Implement login page",
  "description": "Create the login form with validation",
  "type": "Story",
  "priority": "High",
  "order": 0,
  "columnId": "clx1col1",
  "column": {
    "id": "clx1col1",
    "name": "To Do"
  },
  "assigneeId": "clx1user1",
  "assignee": {
    "id": "clx1user1",
    "name": "John Doe",
    "avatar": "/uploads/avatars/abc.webp"
  },
  "sprintId": "clx1spr1",
  "sprint": {
    "id": "clx1spr1",
    "name": "Sprint 1"
  },
  "storyPoints": 5,
  "labels": [
    {
      "id": "clx1lbl1",
      "name": "feature",
      "color": "#22C55E"
    }
  ],
  "watchers": [
    {
      "id": "clx1user1",
      "name": "John Doe"
    }
  ],
  "isCarriedOver": false,
  "carriedOverCount": 0,
  "projectId": "clx1abc123",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## Update Ticket

Update ticket fields.

```http
PATCH /api/projects/[projectId]/tickets/[ticketId]
```

### Request Body

Include only the fields you want to update:

```json
{
  "title": "Updated title",
  "priority": "Critical",
  "assigneeId": "clx1user2"
}
```

### Moving Tickets

To move a ticket to a different column:

```json
{
  "columnId": "clx1col2",
  "order": 0
}
```

The `order` field determines position within the column (0 = top).

## Delete Ticket

Delete a ticket.

```http
DELETE /api/projects/[projectId]/tickets/[ticketId]
```

### Response

```json
{
  "success": true
}
```

## Ticket Attachments

### List Attachments

```http
GET /api/projects/[projectId]/tickets/[ticketId]/attachments
```

### Response

```json
[
  {
    "id": "clx1att1",
    "filename": "screenshot.png",
    "mimeType": "image/png",
    "size": 102400,
    "url": "/uploads/attachments/abc123.png",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### Add Attachment

```http
POST /api/projects/[projectId]/tickets/[ticketId]/attachments
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | File to attach |

### Allowed File Types

| Category | Types |
|----------|-------|
| Images | JPEG, PNG, GIF, WebP |
| Videos | MP4, WebM, OGG, QuickTime |
| Documents | PDF, Word, Excel, TXT, CSV |

:::note
SVG files are not allowed for security reasons.
:::

### Delete Attachment

```http
DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]
```

## Bulk Operations

### Update Multiple Tickets

```http
PATCH /api/projects/[projectId]/tickets
```

### Request Body

```json
{
  "ticketIds": ["clx1tkt1", "clx1tkt2", "clx1tkt3"],
  "updates": {
    "sprintId": "clx1spr2",
    "priority": "High"
  }
}
```

### Delete Multiple Tickets

```http
DELETE /api/projects/[projectId]/tickets
```

### Request Body

```json
{
  "ticketIds": ["clx1tkt1", "clx1tkt2"]
}
```

## Ticket Types

| Type | Description |
|------|-------------|
| `Story` | User-facing feature or requirement |
| `Task` | Technical or operational work |
| `Bug` | Defect or issue to fix |
| `Subtask` | Child task of another ticket |
| `Epic` | Large feature containing multiple stories |

## Ticket Priorities

| Priority | Description |
|----------|-------------|
| `Critical` | Immediate attention required |
| `High` | Important, should be addressed soon |
| `Medium` | Normal priority (default) |
| `Low` | Can be addressed when time permits |

## Ticket Links

Link related tickets to track dependencies and relationships.

### Link Types

| Type | Inverse | Description |
|------|---------|-------------|
| `blocks` | `is_blocked_by` | This ticket blocks another |
| `is_blocked_by` | `blocks` | This ticket is blocked by another |
| `relates_to` | `relates_to` | General relationship |
| `duplicates` | `is_duplicated_by` | This ticket duplicates another |
| `is_duplicated_by` | `duplicates` | This ticket is duplicated by another |

### Create Link

```http
POST /api/projects/[projectId]/tickets/[ticketId]/links
```

#### Request Body

```json
{
  "targetTicketId": "clx1tkt2",
  "linkType": "blocks"
}
```

### Remove Link

```http
DELETE /api/projects/[projectId]/tickets/[ticketId]/links/[linkId]
```

## Ticket Comments

Add comments to tickets for discussion and updates.

### List Comments

```http
GET /api/projects/[projectId]/tickets/[ticketId]/comments
```

#### Response

```json
[
  {
    "id": "clx1cmt1",
    "content": "This needs more details.",
    "author": {
      "id": "clx1user1",
      "name": "John Doe",
      "avatar": "/uploads/avatars/abc.webp"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### Add Comment

```http
POST /api/projects/[projectId]/tickets/[ticketId]/comments
```

#### Request Body

```json
{
  "content": "This needs more details."
}
```

### Update Comment

```http
PATCH /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
```

#### Request Body

```json
{
  "content": "Updated comment text."
}
```

### Delete Comment

```http
DELETE /api/projects/[projectId]/tickets/[ticketId]/comments/[commentId]
```

## Ticket History

View the edit history of a ticket.

### Get History

```http
GET /api/projects/[projectId]/tickets/[ticketId]/history
```

#### Response

```json
[
  {
    "id": "clx1edit1",
    "field": "priority",
    "oldValue": "Medium",
    "newValue": "High",
    "changedBy": {
      "id": "clx1user1",
      "name": "John Doe"
    },
    "changedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

Tracked fields include: title, description, type, priority, assignee, sprint, story points, dates, and more.
