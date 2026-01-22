---
sidebar_position: 5
---

# Sprints API

Endpoints for managing sprints and sprint planning.

## List Sprints

Get all sprints in a project.

```http
GET /api/projects/[projectId]/sprints
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (planning, active, completed) |

### Response

```json
[
  {
    "id": "clx1spr1",
    "name": "Sprint 1",
    "goal": "Complete authentication feature",
    "startDate": "2024-01-15T00:00:00.000Z",
    "endDate": "2024-01-29T00:00:00.000Z",
    "status": "active",
    "projectId": "clx1abc123",
    "createdAt": "2024-01-10T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Create Sprint

Create a new sprint.

```http
POST /api/projects/[projectId]/sprints
```

### Request Body

```json
{
  "name": "Sprint 2",
  "goal": "Build user dashboard",
  "startDate": "2024-01-29",
  "endDate": "2024-02-12"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Sprint name (auto-generated if not provided) |
| `goal` | string | No | Sprint objective |
| `startDate` | string | No | Start date (ISO format) |
| `endDate` | string | No | End date (ISO format) |

### Response

```json
{
  "id": "clx1spr2",
  "name": "Sprint 2",
  "goal": "Build user dashboard",
  "startDate": "2024-01-29T00:00:00.000Z",
  "endDate": "2024-02-12T00:00:00.000Z",
  "status": "planning",
  "projectId": "clx1abc123",
  "createdAt": "2024-01-20T10:30:00.000Z",
  "updatedAt": "2024-01-20T10:30:00.000Z"
}
```

## Get Sprint

Get a specific sprint with tickets.

```http
GET /api/projects/[projectId]/sprints/[sprintId]
```

### Response

```json
{
  "id": "clx1spr1",
  "name": "Sprint 1",
  "goal": "Complete authentication feature",
  "startDate": "2024-01-15T00:00:00.000Z",
  "endDate": "2024-01-29T00:00:00.000Z",
  "status": "active",
  "tickets": [
    {
      "id": "clx1tkt1",
      "title": "Implement login page",
      "type": "Story",
      "priority": "High",
      "storyPoints": 5
    }
  ],
  "ticketHistory": [
    {
      "ticketId": "clx1tkt1",
      "entryType": "added",
      "enteredAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Get Active Sprint

Get the currently active sprint.

```http
GET /api/projects/[projectId]/sprints/active
```

### Response

Returns the active sprint or `null` if no sprint is active.

## Update Sprint

Update sprint details.

```http
PATCH /api/projects/[projectId]/sprints/[sprintId]
```

### Request Body

```json
{
  "name": "Sprint 1 - Extended",
  "goal": "Updated goal"
}
```

## Delete Sprint

Delete a sprint. Tickets are moved to backlog (no sprint).

```http
DELETE /api/projects/[projectId]/sprints/[sprintId]
```

:::note
Only sprints in `planning` status can be deleted.
:::

## Start Sprint

Start a planning sprint.

```http
POST /api/projects/[projectId]/sprints/[sprintId]/start
```

### Request Body

```json
{
  "startDate": "2024-01-29",
  "endDate": "2024-02-12"
}
```

### Prerequisites

- Sprint must be in `planning` status
- No other sprint can be `active`

### Response

```json
{
  "id": "clx1spr2",
  "status": "active",
  "startDate": "2024-01-29T00:00:00.000Z",
  "endDate": "2024-02-12T00:00:00.000Z"
}
```

## Complete Sprint

Complete an active sprint.

```http
POST /api/projects/[projectId]/sprints/[sprintId]/complete
```

### Request Body

```json
{
  "incompleteAction": "moveToNextSprint",
  "nextSprintId": "clx1spr3"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `incompleteAction` | string | What to do with incomplete tickets |
| `nextSprintId` | string | Target sprint for carryover (if applicable) |

### Incomplete Action Options

| Action | Description |
|--------|-------------|
| `moveToNextSprint` | Move to specified sprint (requires `nextSprintId`) |
| `moveToBacklog` | Remove sprint assignment |
| `keepInSprint` | Leave tickets in completed sprint |

### Response

```json
{
  "id": "clx1spr1",
  "status": "completed",
  "completedTicketCount": 8,
  "incompleteTicketCount": 2,
  "completedStoryPoints": 34,
  "incompleteStoryPoints": 8
}
```

## Extend Sprint

Extend an active sprint's end date.

```http
POST /api/projects/[projectId]/sprints/[sprintId]/extend
```

### Request Body

```json
{
  "newEndDate": "2024-02-05"
}
```

## Sprint Settings

### Get Settings

```http
GET /api/projects/[projectId]/sprints/settings
```

### Response

```json
{
  "defaultSprintDuration": 2,
  "autoCarryOverIncomplete": true,
  "doneColumnIds": ["clx1col3"]
}
```

### Update Settings

```http
PATCH /api/projects/[projectId]/sprints/settings
```

### Request Body

```json
{
  "defaultSprintDuration": 3,
  "autoCarryOverIncomplete": false,
  "doneColumnIds": ["clx1col3", "clx1col4"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `defaultSprintDuration` | number | Default sprint length in weeks (1-4) |
| `autoCarryOverIncomplete` | boolean | Auto-move incomplete tickets on completion |
| `doneColumnIds` | string[] | Column IDs that indicate "done" status |

## Sprint Status

| Status | Description |
|--------|-------------|
| `planning` | Sprint is being prepared, not yet started |
| `active` | Sprint is in progress |
| `completed` | Sprint has ended |

## Carryover Tracking

Tickets that are carried over from one sprint to another are marked:

```json
{
  "id": "clx1tkt1",
  "isCarriedOver": true,
  "carriedFromSprintId": "clx1spr1",
  "carriedOverCount": 1
}
```

| Field | Description |
|-------|-------------|
| `isCarriedOver` | Whether ticket was carried from another sprint |
| `carriedFromSprintId` | Original sprint the ticket was planned for |
| `carriedOverCount` | Number of times the ticket has been carried over |
