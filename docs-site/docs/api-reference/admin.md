---
sidebar_position: 6
---

# Admin API

Administrative endpoints for user management, system settings, and database operations. All endpoints require system admin authentication.

## User Management

### List Users

Get all users with optional filtering.

```http
GET /api/admin/users
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by username, name, or email |
| `status` | string | Filter by `active` or `disabled` |
| `role` | string | Filter by `admin` or `user` |
| `sortBy` | string | Sort field: `username`, `name`, `email`, `createdAt` |
| `sortOrder` | string | Sort direction: `asc` or `desc` |

#### Response

```json
[
  {
    "id": "clx1user1",
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "avatar": "/uploads/avatars/abc.webp",
    "isSystemAdmin": false,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create User

Create a new user account (bypasses registration).

```http
POST /api/admin/users
```

#### Request Body

```json
{
  "username": "newuser",
  "email": "new@example.com",
  "name": "New User",
  "password": "SecurePass123",
  "isSystemAdmin": false,
  "confirmPassword": "AdminPassword123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | 3-30 chars, alphanumeric/dash/underscore |
| `email` | string | No | Valid email, must be unique |
| `name` | string | No | Display name |
| `password` | string | Yes | New user's password |
| `isSystemAdmin` | boolean | No | Grant admin privileges |
| `confirmPassword` | string | Yes | Your admin password for confirmation |

### Get User

Get a specific user by ID.

```http
GET /api/admin/users/[userId]
```

### Update User

Update user details.

```http
PATCH /api/admin/users/[userId]
```

#### Request Body

```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "isSystemAdmin": true,
  "isActive": false
}
```

All fields are optional. Only include fields you want to update.

#### Restrictions

- Cannot demote yourself from admin (if sole admin)
- Cannot disable your own account
- Cannot delete your own account

### Delete User

Permanently delete a user.

```http
DELETE /api/admin/users/[userId]
```

#### Request Body

```json
{
  "confirmPassword": "YourAdminPassword"
}
```

:::danger
User deletion is permanent and removes all user data.
:::

## System Settings

### Get Settings

Retrieve current system settings.

```http
GET /api/admin/settings
```

#### Response

```json
{
  "id": "system-settings",
  "maxImageSize": 5242880,
  "maxVideoSize": 52428800,
  "maxDocumentSize": 10485760,
  "maxAttachmentsPerTicket": 20,
  "allowedImageTypes": ["image/jpeg", "image/png", "image/gif", "image/webp"],
  "allowedVideoTypes": ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  "allowedDocumentTypes": ["application/pdf", "text/plain", "text/csv"]
}
```

### Update Settings

Update system settings.

```http
PATCH /api/admin/settings
```

#### Request Body

```json
{
  "maxImageSize": 10485760,
  "maxAttachmentsPerTicket": 30
}
```

| Field | Type | Description |
|-------|------|-------------|
| `maxImageSize` | number | Max image size in bytes |
| `maxVideoSize` | number | Max video size in bytes |
| `maxDocumentSize` | number | Max document size in bytes |
| `maxAttachmentsPerTicket` | number | Max attachments per ticket |
| `allowedImageTypes` | string[] | Allowed image MIME types |
| `allowedVideoTypes` | string[] | Allowed video MIME types |
| `allowedDocumentTypes` | string[] | Allowed document MIME types |

## Database Operations

All database operations require password confirmation and are destructive.

### Export Database

Create a full database backup.

```http
POST /api/admin/database/export
```

#### Request Body

```json
{
  "confirmPassword": "YourAdminPassword"
}
```

#### Response

Returns a JSON file download containing all database data.

### Import Database

Restore from a backup file.

```http
POST /api/admin/database/import
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Backup JSON file |
| `confirmPassword` | string | Your admin password |

#### Response

```json
{
  "success": true,
  "imported": {
    "users": 5,
    "projects": 3,
    "tickets": 42,
    "sprints": 8
  }
}
```

:::warning
Import replaces all existing data. All users will be signed out.
:::

### Wipe Database

Completely reset the database.

```http
POST /api/admin/database/wipe
```

#### Request Body

```json
{
  "confirmPassword": "YourAdminPassword",
  "confirmation": "wipe all data"
}
```

#### Response

```json
{
  "success": true,
  "newAdminCredentials": {
    "username": "admin",
    "temporaryPassword": "generated-temp-password"
  }
}
```

A new admin account is created after wipe.

:::danger
This permanently deletes all data including users, projects, and tickets.
:::

### Wipe Projects Only

Remove all projects while keeping users.

```http
POST /api/admin/database/wipe-projects
```

#### Request Body

```json
{
  "confirmPassword": "YourAdminPassword"
}
```

#### Response

```json
{
  "success": true,
  "wiped": {
    "projects": 3,
    "tickets": 42,
    "sprints": 8
  }
}
```

This preserves:
- User accounts and passwords
- System settings

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "System admin access required"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid password confirmation"
}
```

Or for self-modification restrictions:

```json
{
  "error": "Cannot disable your own account"
}
```
