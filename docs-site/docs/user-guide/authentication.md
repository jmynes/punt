---
sidebar_position: 1
---

# Authentication

PUNT uses a secure authentication system built on NextAuth.js v5. This guide covers registration, login, and account management.

## Registration

New users can register at `/register` with the following requirements:

### Username Requirements
- 3-30 characters
- Alphanumeric characters, dashes, and underscores only
- Must be unique (case-insensitive)

### Password Requirements
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

### Email
- Optional but recommended for password recovery
- Must be unique if provided

## Login

Users can log in at `/login` using either:
- **Username** + Password
- **Email** + Password

### Session Management

- Sessions are stored as JWTs in HTTP-only cookies
- Sessions persist across browser restarts
- Changing your password invalidates all existing sessions

## Account Settings

### Profile Management

Access your profile settings at `/profile`:

- **Display Name**: Update how your name appears across PUNT
- **Avatar**: Upload a profile picture (WebP conversion, max 2MB)
- **Email**: Change your email address (requires password confirmation)
- **Password**: Update your password (requires current password)

### Account Deletion

You can permanently delete your account from the profile page:

1. Navigate to Profile Settings
2. Click "Delete Account"
3. Enter your password
4. Type the confirmation phrase
5. Confirm deletion

:::warning
Account deletion is permanent and cannot be undone. All your data will be removed.
:::

## Admin Features

System administrators have additional capabilities:

- View and manage all users
- Enable/disable user accounts
- Grant or revoke admin privileges
- Configure system settings

Access the admin panel at `/admin` (requires system admin role).

## Security Features

PUNT implements several security measures:

| Feature | Description |
|---------|-------------|
| Password Hashing | bcryptjs with 12 salt rounds |
| Rate Limiting | Login: 10 attempts per 15 minutes |
| Session Invalidation | Password changes invalidate all sessions |
| Soft Delete | Disabled accounts can be restored |
| CSRF Protection | Built into NextAuth.js |
