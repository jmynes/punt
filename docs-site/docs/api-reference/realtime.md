---
sidebar_position: 8
---

# Real-time Events API

PUNT provides Server-Sent Events (SSE) for real-time updates across browser tabs and users.

## Overview

Real-time events enable:
- Multi-tab synchronization
- Multi-user collaboration
- Live updates without polling

## Connection

### Project Events

Subscribe to events for a specific project:

```http
GET /api/projects/[projectId]/events
```

Receives: ticket and label events for the project.

### Project List Events

Subscribe to project list changes:

```http
GET /api/projects/events
```

Receives: project created/updated/deleted events.

### User Events

Subscribe to user profile changes:

```http
GET /api/users/events
```

Receives: user profile updates.

## Event Format

Events are sent as JSON with the following structure:

```json
{
  "type": "ticket.created",
  "data": {
    "id": "clx1tkt1",
    "title": "New ticket",
    "type": "Task"
  },
  "tabId": "abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `type` | Event type identifier |
| `data` | Event payload (varies by type) |
| `tabId` | Originating browser tab ID |
| `timestamp` | When the event occurred |

## Event Types

### Ticket Events

| Event | Description | Data |
|-------|-------------|------|
| `ticket.created` | New ticket created | Full ticket object |
| `ticket.updated` | Ticket fields changed | Ticket with changed fields |
| `ticket.moved` | Ticket moved between columns | Ticket with new columnId, order |
| `ticket.deleted` | Ticket deleted | `{ id: string }` |

### Label Events

| Event | Description | Data |
|-------|-------------|------|
| `label.created` | New label created | Full label object |
| `label.deleted` | Label deleted | `{ id: string }` |

### Project Events

| Event | Description | Data |
|-------|-------------|------|
| `project.created` | New project created | Full project object |
| `project.updated` | Project details changed | Project with changed fields |
| `project.deleted` | Project deleted | `{ id: string }` |

### User Events

| Event | Description | Data |
|-------|-------------|------|
| `user.updated` | User profile changed | User summary object |

### Database Events

| Event | Description | Data |
|-------|-------------|------|
| `database.wiped` | Full database wipe or import | `{}` |
| `database.projects.wiped` | All projects wiped | `{}` |

## Client Implementation

### JavaScript Example

```javascript
const projectId = 'clx1abc123'
const eventSource = new EventSource(`/api/projects/${projectId}/events`)

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  // Skip events from this tab
  if (data.tabId === myTabId) return

  switch (data.type) {
    case 'ticket.created':
      addTicketToBoard(data.data)
      break
    case 'ticket.updated':
      updateTicketInBoard(data.data)
      break
    case 'ticket.moved':
      moveTicketOnBoard(data.data)
      break
    case 'ticket.deleted':
      removeTicketFromBoard(data.data.id)
      break
  }
}

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error)
  // EventSource will auto-reconnect
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  eventSource.close()
})
```

### React Query Integration

PUNT uses React Query for cache invalidation:

```typescript
function useProjectEvents(projectId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/projects/${projectId}/events`
    )

    eventSource.onmessage = (event) => {
      const { type, data, tabId } = JSON.parse(event.data)

      if (tabId === getTabId()) return

      // Invalidate relevant queries
      if (type.startsWith('ticket.')) {
        queryClient.invalidateQueries(['tickets', projectId])
      }
      if (type.startsWith('label.')) {
        queryClient.invalidateQueries(['labels', projectId])
      }
    }

    return () => eventSource.close()
  }, [projectId, queryClient])
}
```

## Tab ID Header

Include a unique tab ID in API requests to prevent event echoing:

```http
X-Tab-Id: abc123
```

Events include the originating `tabId`, allowing clients to filter out their own changes.

### Generating Tab IDs

```javascript
const tabId = crypto.randomUUID()

fetch('/api/projects/123/tickets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tab-Id': tabId
  },
  body: JSON.stringify(ticketData)
})
```

## Connection Management

### Keepalive

The server sends comment keepalives every 30 seconds to prevent connection timeout:

```
: keepalive
```

### Auto-Reconnect

`EventSource` automatically reconnects on connection loss. No additional handling required.

### Nginx Configuration

If using nginx as a reverse proxy, disable buffering for SSE:

```nginx
location /api {
  proxy_pass http://localhost:3000;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;
  proxy_cache off;

  # For SSE
  proxy_set_header X-Accel-Buffering no;
}
```

PUNT includes `X-Accel-Buffering: no` in SSE responses.

## Error Handling

### Connection Errors

```javascript
eventSource.onerror = (error) => {
  if (eventSource.readyState === EventSource.CLOSED) {
    // Connection closed permanently
    showReconnectMessage()
  } else {
    // Temporary error, will auto-reconnect
    console.log('SSE reconnecting...')
  }
}
```

### Authentication

SSE connections require a valid session cookie. If the session expires:

1. Connection receives an error
2. Redirect to login
3. Re-establish connection after authentication

## Database Events

Special handling for database operations:

### Database Wipe

When `database.wiped` is received:
1. Clear all local state
2. Sign out the user
3. Redirect to login

```javascript
if (data.type === 'database.wiped') {
  // Clear all queries
  queryClient.clear()
  // Sign out
  signOut({ callbackUrl: '/login' })
}
```

### Projects Wipe

When `database.projects.wiped` is received:
1. Invalidate all project-related queries
2. Navigate to home page

```javascript
if (data.type === 'database.projects.wiped') {
  queryClient.invalidateQueries(['projects'])
  queryClient.invalidateQueries(['tickets'])
  queryClient.invalidateQueries(['sprints'])
  router.push('/')
}
```
