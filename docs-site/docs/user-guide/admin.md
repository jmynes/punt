---
sidebar_position: 7
---

# Admin Panel

The Admin Panel provides system administrators with tools to manage users, configure system settings, and perform database operations.

## Accessing the Admin Panel

Navigate to `/admin` in your browser. Access is restricted to users with the **System Admin** role.

:::note
The first registered user automatically receives system admin privileges.
:::

## User Management

### Viewing Users

The Users page (`/admin/users`) displays all registered users with:

- Username and display name
- Email address
- Admin status badge
- Account status (active/disabled)
- Registration date

### Filtering and Sorting

Users can be filtered by:
- **Status**: Active or disabled accounts
- **Role**: Admin or regular users
- **Search**: Username, name, or email

Sort by clicking column headers.

### Creating Users

Admins can create users directly:

1. Click **+ New User**
2. Fill in user details:
   - Username (required)
   - Email (optional)
   - Display name (optional)
   - Password (required)
3. Optionally grant admin privileges
4. Click **Create User**

:::info
Creating users requires password confirmation to prevent unauthorized access.
:::

### Managing User Accounts

#### Enable/Disable Users

Disabled users cannot log in but their data is preserved:

1. Find the user in the list
2. Click the toggle switch in the Status column
3. Confirm the action

:::warning
Self-disabling is prevented. You cannot disable your own account.
:::

#### Grant/Revoke Admin

Toggle admin privileges:

1. Find the user in the list
2. Click the toggle in the Admin column
3. Confirm the action

:::danger
**Sole Admin Protection**: If you're the only admin, you cannot revoke your own admin status. This prevents accidental lockout.
:::

#### Delete Users

Users can be permanently deleted:

1. Click the delete button for the user
2. Enter your password to confirm
3. Click **Delete User**

:::danger
User deletion is permanent. All user data is removed. Consider disabling instead for audit trail preservation.
:::

## System Settings

Access system settings at `/admin/settings`.

### Upload Configuration

Configure file upload limits:

| Setting | Description | Default |
|---------|-------------|---------|
| **Max Image Size** | Maximum size for image uploads | 5 MB |
| **Max Video Size** | Maximum size for video uploads | 50 MB |
| **Max Document Size** | Maximum size for document uploads | 10 MB |
| **Max Attachments** | Maximum attachments per ticket | 20 |

### Allowed File Types

Control which file types can be uploaded:

**Images:**
- JPEG (`image/jpeg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)

**Videos:**
- MP4 (`video/mp4`)
- WebM (`video/webm`)
- OGG (`video/ogg`)
- QuickTime (`video/quicktime`)

**Documents:**
- PDF (`application/pdf`)
- Word (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- Excel (`application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- Text (`text/plain`)
- CSV (`text/csv`)

:::note
SVG files are blocked for security reasons (potential XSS via embedded scripts).
:::

## Database Operations

Access database operations at `/admin/database` (or via the admin settings page).

:::danger
Database operations are destructive and cannot be undone. Always backup your data before proceeding.
:::

### Export Database

Create a full backup of your PUNT database:

1. Click **Export Database**
2. Enter your password to confirm
3. Download the backup file

The export includes all:
- Users and settings
- Projects, columns, members
- Tickets, labels, sprints
- Attachments metadata

### Import Database

Restore from a previous backup:

1. Click **Import Database**
2. Select the backup file
3. Enter your password to confirm
4. Wait for import to complete

:::warning
Import **replaces all existing data**. All current users (except the importer) will be signed out.
:::

### Wipe Database

Completely reset PUNT to a fresh state:

1. Click **Wipe Database**
2. Enter your password
3. Confirm by typing the required phrase
4. A new admin account is created

Use cases:
- Starting fresh in a new environment
- Removing all test data before production

### Wipe Projects Only

Remove all projects while keeping users:

1. Click **Wipe Projects**
2. Enter your password
3. Confirm the action

This removes:
- All projects
- All tickets, sprints, labels
- All columns and attachments

This preserves:
- User accounts
- System settings

## Security Considerations

### Audit Trail

Admin actions are logged, including:
- User creation/deletion
- Permission changes
- Database operations

### Rate Limiting

Admin operations have additional rate limits to prevent abuse.

### Session Security

All admin operations require:
- Active session
- System admin role
- Password confirmation for destructive actions
