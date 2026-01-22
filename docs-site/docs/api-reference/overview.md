---
sidebar_position: 1
---

# API Overview

PUNT provides a RESTful API for integrating with external tools and automating workflows.

## Base URL

All API endpoints are relative to your PUNT instance:

```
https://your-punt-instance.com/api
```

For local development:

```
http://localhost:3000/api
```

## Authentication

Most API endpoints require authentication. PUNT uses session-based authentication with cookies.

### Getting a Session

1. Make a POST request to `/api/auth/callback/credentials` with your username and password
2. The response will set a session cookie
3. Include this cookie in subsequent requests

See [Authentication API](/api-reference/authentication) for detailed examples.

## Request Format

### Headers

```http
Content-Type: application/json
Cookie: next-auth.session-token=<your-session-token>
```

### Body

Request bodies should be JSON-encoded:

```json
{
  "title": "My new ticket",
  "type": "Task",
  "priority": "Medium"
}
```

## Response Format

### Success Response

```json
{
  "id": "abc123",
  "title": "My new ticket",
  "type": "Task",
  "priority": "Medium",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Error Response

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Authentication required |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

| Endpoint | Limit |
|----------|-------|
| Login | 10 requests per 15 minutes |
| Registration | 5 requests per hour |
| Password Change | 5 requests per 15 minutes |
| General API | Varies by endpoint |

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1705312800
```

## Real-time Events

PUNT provides Server-Sent Events (SSE) endpoints for real-time updates:

- `/api/projects/[projectId]/events` - Project events (tickets, labels)
- `/api/projects/events` - Project list events
- `/api/users/events` - User profile events

See the individual API sections for SSE event documentation.

## API Sections

- [Authentication](/api-reference/authentication) - Login, registration, session management
- [Projects](/api-reference/projects) - Project CRUD operations
- [Tickets](/api-reference/tickets) - Ticket management
- [Sprints](/api-reference/sprints) - Sprint planning and management
