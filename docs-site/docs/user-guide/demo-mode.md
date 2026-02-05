---
sidebar_position: 8
---

# Demo Mode

Demo Mode allows you to try PUNT without setting up a database. All data is stored in your browser's localStorage.

## Enabling Demo Mode

Set the environment variable before starting PUNT:

```bash
NEXT_PUBLIC_DEMO_MODE=true pnpm dev
```

Or add it to your `.env` file:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

## How Demo Mode Works

### Client-Side Storage

In demo mode:
- All data is stored in `localStorage` (prefixed with `punt-demo-`)
- No database connection is required
- Data persists across page refreshes but is browser-specific

### Auto-Authentication

You're automatically signed in as a demo user with admin privileges:

| Field | Value |
|-------|-------|
| Username | `demo` |
| Name | Demo User |
| Role | System Admin |

### Data Provider Architecture

PUNT uses a DataProvider abstraction that automatically switches between:

| Mode | Provider | Storage |
|------|----------|---------|
| Production | `APIDataProvider` | SQLite via API |
| Demo | `DemoDataProvider` | localStorage |

Components use React Query hooks that internally call the appropriate provider.

## Demo Data

Demo mode comes pre-populated with sample data:

### Demo Project

- **Project**: "Demo Project" with key `DEMO`
- **Columns**: To Do, In Progress, Review, Done
- **Labels**: bug, feature, documentation, urgent

### Sample Tickets

Several tickets demonstrating different types:
- Stories with descriptions
- Bugs with priorities
- Tasks with assignments
- Subtasks linked to parents

### Demo Sprint

An active sprint with assigned tickets to demonstrate sprint planning.

## Limitations

Demo mode has some differences from production:

| Feature | Production | Demo |
|---------|------------|------|
| Multi-user | Yes | Single user only |
| Real-time sync | SSE across tabs/users | localStorage events only |
| Data persistence | Database | Browser localStorage |
| File uploads | Server filesystem | Not supported |
| Multiple projects | Unlimited | Pre-configured demo |

## Use Cases

### Evaluation

Try PUNT's features before committing to a full setup:
- Explore the Kanban board
- Test sprint planning
- Review the backlog interface

### Development

Demo mode is useful for:
- Frontend development without backend
- UI testing and prototyping
- Demonstration and training

### Deployment Preview

Some platforms (like Railway) can deploy demo mode for preview environments:

```env
NEXT_PUBLIC_DEMO_MODE=true
AUTH_SECRET=any-secret-for-demo
AUTH_TRUST_HOST=true
```

## Clearing Demo Data

To reset demo mode to initial state:

1. Open browser developer tools
2. Go to Application → Local Storage
3. Delete all keys starting with `punt-demo-`
4. Refresh the page

Or in the browser console:

```javascript
Object.keys(localStorage)
  .filter(key => key.startsWith('punt-demo-'))
  .forEach(key => localStorage.removeItem(key))
location.reload()
```

## Transitioning to Production

When ready to move from demo to production:

1. Set up the database:
   ```bash
   pnpm db:push
   ```

2. Remove demo mode environment variable:
   ```bash
   # Remove NEXT_PUBLIC_DEMO_MODE=true from .env
   ```

3. Start without demo mode:
   ```bash
   pnpm dev
   ```

4. Register a new account (first user becomes admin)

:::note
Demo mode data cannot be migrated to production. You'll start fresh with a clean database.
:::
