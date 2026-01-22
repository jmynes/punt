---
sidebar_position: 2
---

# Authentication API

PUNT uses NextAuth.js for authentication. This section covers the authentication-related endpoints.

## Register a New User

Create a new user account.

```http
POST /api/auth/register
```

### Request Body

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | 3-30 characters, alphanumeric/dash/underscore |
| `email` | string | No | Valid email address, must be unique |
| `password` | string | Yes | Min 12 chars, 1 upper, 1 lower, 1 number |
| `name` | string | No | Display name |

### Response

```json
{
  "id": "clx1abc123",
  "username": "johndoe",
  "email": "john@example.com",
  "name": "John Doe",
  "isSystemAdmin": false
}
```

### Errors

| Status | Error | Description |
|--------|-------|-------------|
| `400` | Validation failed | Invalid input data |
| `400` | Username already taken | Username exists |
| `400` | Email already registered | Email exists |
| `429` | Rate limit exceeded | Too many registration attempts |

## Login

Authenticate and create a session.

```http
POST /api/auth/callback/credentials
```

### Request Body

```json
{
  "username": "johndoe",
  "password": "SecurePass123"
}
```

Or login with email:

```json
{
  "username": "john@example.com",
  "password": "SecurePass123"
}
```

### Response

On success, a session cookie is set in the response headers.

```http
Set-Cookie: next-auth.session-token=...; Path=/; HttpOnly; SameSite=Lax
```

## Get Current Session

Check if the user is authenticated and get session details.

```http
GET /api/auth/session
```

### Response

```json
{
  "user": {
    "id": "clx1abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "isSystemAdmin": false
  },
  "expires": "2024-02-15T10:30:00.000Z"
}
```

Returns an empty object `{}` if not authenticated.

## Logout

End the current session.

```http
POST /api/auth/signout
```

### Request Body

```json
{
  "callbackUrl": "/"
}
```

### Response

The session cookie is cleared and the user is redirected to the callback URL.

## Verify Credentials

Check if credentials are valid without creating a session.

```http
POST /api/auth/verify-credentials
```

### Request Body

```json
{
  "username": "johndoe",
  "password": "SecurePass123"
}
```

### Response

```json
{
  "valid": true,
  "user": {
    "id": "clx1abc123",
    "username": "johndoe",
    "name": "John Doe"
  }
}
```

## User Profile Endpoints

### Get Current User Profile

```http
GET /api/me
```

### Response

```json
{
  "id": "clx1abc123",
  "username": "johndoe",
  "email": "john@example.com",
  "name": "John Doe",
  "avatar": "/uploads/avatars/abc123.webp",
  "isSystemAdmin": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Profile

```http
PATCH /api/me
```

### Request Body

```json
{
  "name": "John Smith"
}
```

### Change Email

```http
PATCH /api/me/email
```

### Request Body

```json
{
  "email": "newemail@example.com",
  "password": "CurrentPassword123"
}
```

### Change Password

```http
PATCH /api/me/password
```

### Request Body

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePass456"
}
```

:::note
Changing your password invalidates all existing sessions, requiring re-authentication on all devices.
:::

## Avatar Management

### Upload Avatar

```http
POST /api/me/avatar
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file (JPEG, PNG, GIF, WebP), max 2MB |

Images are automatically:
- Resized to 256x256
- Converted to WebP format
- Stripped of metadata

### Delete Avatar

```http
DELETE /api/me/avatar
```

## Delete Account

Permanently delete the user account.

```http
DELETE /api/me/account
```

### Request Body

```json
{
  "password": "CurrentPassword123",
  "confirmation": "delete my account"
}
```

:::danger
Account deletion is permanent and cannot be undone.
:::
