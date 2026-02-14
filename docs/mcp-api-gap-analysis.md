# MCP and API Coverage Gap Analysis

**Date:** 2025-02-12
**Ticket:** PUNT-53

This document audits the MCP tools and API routes to identify missing coverage, inconsistencies, and gaps between them.

## Executive Summary

The MCP server currently exposes 31 tools covering tickets, projects, sprints, members, labels, and columns. However, several API capabilities are not yet accessible via MCP, representing opportunities for improved automation and conversational workflows.

### Key Gaps Identified

1. **Missing CRUD operations**: Attachments, comments, ticket links, watchers
2. **Sprint operations**: Sprint extend, sprint settings management
3. **Admin operations**: User management, system settings, database operations
4. **Roles management**: Project-level role CRUD, permissions management
5. **Search/utility endpoints**: Ticket search, dashboard stats, available users

---

## Detailed Gap Analysis

### 1. Tickets

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `get_ticket` | Get ticket by key | GET /api/projects/[projectId]/tickets |
| `list_tickets` | List/filter tickets | GET /api/projects/[projectId]/tickets |
| `create_ticket` | Create a ticket | POST /api/projects/[projectId]/tickets |
| `update_ticket` | Update ticket fields | PATCH /api/projects/[projectId]/tickets/[ticketId] |
| `move_ticket` | Move to column/sprint | PATCH /api/projects/[projectId]/tickets/[ticketId] |
| `delete_ticket` | Delete a ticket | DELETE /api/projects/[projectId]/tickets/[ticketId] |

#### Missing MCP Coverage

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| GET /api/projects/[projectId]/tickets/search | Medium | Full-text search across tickets |
| GET /api/projects/[projectId]/tickets/[ticketId]/attachments | High | List ticket attachments |
| POST /api/projects/[projectId]/tickets/[ticketId]/attachments | High | Add attachment to ticket |
| DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId] | High | Remove attachment |
| GET/POST /api/projects/[projectId]/tickets/[ticketId]/links | Medium | List/create ticket links |
| DELETE /api/projects/[projectId]/tickets/[ticketId]/links/[linkId] | Medium | Remove ticket link |

**Note:** The MCP api-client has no functions for attachments or ticket links. The existing `list_tickets` does client-side filtering but could benefit from using the server-side search endpoint for better performance.

#### Missing API Endpoints (Not in MCP or API)
- **Ticket comments**: No comment CRUD endpoints exist in the API
- ~~**Ticket links**: TicketLink model exists but no API endpoints~~ **RESOLVED** — API endpoints added: `GET/POST /api/projects/[projectId]/tickets/[ticketId]/links`, `DELETE .../links/[linkId]`. MCP tools not yet added.
- **Ticket watchers**: No direct watcher management endpoints (only via ticket update with `watcherIds`)
- **Ticket history/edits**: TicketEdit model exists but no API to retrieve edit history

---

### 2. Sprints

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `list_sprints` | List sprints | GET /api/projects/[projectId]/sprints |
| `get_sprint` | Get sprint details | GET /api/projects/[projectId]/sprints/[sprintId] |
| `create_sprint` | Create sprint | POST /api/projects/[projectId]/sprints |
| `update_sprint` | Update sprint | PATCH /api/projects/[projectId]/sprints/[sprintId] |
| `start_sprint` | Start sprint | POST /api/projects/[projectId]/sprints/[sprintId]/start |
| `complete_sprint` | Complete sprint | POST /api/projects/[projectId]/sprints/[sprintId]/complete |
| `delete_sprint` | Delete sprint | DELETE /api/projects/[projectId]/sprints/[sprintId] |

#### Missing MCP Coverage

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| POST /api/projects/[projectId]/sprints/[sprintId]/extend | Medium | Extend active sprint duration |
| GET /api/projects/[projectId]/sprints/settings | Low | Get sprint settings (default duration, auto-carryover) |
| PATCH /api/projects/[projectId]/sprints/settings | Low | Update sprint settings |
| GET /api/projects/[projectId]/sprints/active | Low | Get currently active sprint |

---

### 3. Labels

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `list_labels` | List labels | GET /api/projects/[projectId]/labels |
| `create_label` | Create label | POST /api/projects/[projectId]/labels |
| `delete_label` | Delete label | DELETE /api/projects/[projectId]/labels/[labelId] |
| `add_label_to_ticket` | Add label to ticket | PATCH /api/projects/[projectId]/tickets/[ticketId] |
| `remove_label_from_ticket` | Remove from ticket | PATCH /api/projects/[projectId]/tickets/[ticketId] |

#### Missing MCP Coverage

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| PATCH /api/projects/[projectId]/labels/[labelId] | Medium | Update label (name, color) - API exists but MCP uses delete+recreate workaround |

**Note:** The MCP `update_label` tool currently deletes and recreates the label, which loses the label ID and any ticket associations. A proper API-based update should be implemented.

---

### 4. Projects

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `list_projects` | List projects | GET /api/projects |
| `get_project` | Get project details | GET /api/projects/[projectId] |
| `create_project` | Create project | POST /api/projects |
| `update_project` | Update project | PATCH /api/projects/[projectId] |
| `delete_project` | Delete project | DELETE /api/projects/[projectId] |

#### Missing MCP Coverage

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| GET /api/projects/[projectId]/available-users | Low | List users not yet members of project |

---

### 5. Members

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `list_members` | List project members | Direct DB query (should use API) |
| `add_member` | Add member | POST /api/projects/[projectId]/members |
| `remove_member` | Remove member | DELETE /api/projects/[projectId]/members/[memberId] |
| `change_member_role` | Change role | PATCH /api/projects/[projectId]/members/[memberId] |
| `list_users` | List all system users | GET /api/admin/users |

**Note:** The `list_members` tool queries the database directly instead of using the API. This bypasses API authorization and should be refactored.

---

### 6. Columns

#### Currently Available in MCP
| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `list_columns` | List columns | Direct DB query (should use API) |
| `create_column` | Create column | POST /api/projects/[projectId]/columns |
| `rename_column` | Rename column | PATCH /api/projects/[projectId]/columns/[columnId] |
| `reorder_column` | Reorder column | PATCH /api/projects/[projectId]/columns/[columnId] |
| `delete_column` | Delete column | DELETE /api/projects/[projectId]/columns/[columnId] |

**Note:** The `list_columns` tool queries the database directly instead of using the API.

---

### 7. Roles (Project-level)

#### API Endpoints Available (MCP tools NOT yet implemented)

| API Endpoint | Priority | Description | MCP Status |
|--------------|----------|-------------|------------|
| GET /api/projects/[projectId]/roles | Medium | List project roles | Not in MCP |
| POST /api/projects/[projectId]/roles | Medium | Create custom role | Not in MCP |
| GET/PATCH/DELETE /api/projects/[projectId]/roles/[roleId] | Medium | Manage role | Not in MCP |
| POST /api/projects/[projectId]/roles/reorder | Low | Reorder roles | Not in MCP |
| GET /api/projects/[projectId]/my-permissions | Low | Current user permissions | Not in MCP |

---

### 8. Admin Operations

#### Currently NOT Available in MCP

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| GET /api/admin/users | Low* | List users (already used by `list_users`) |
| POST /api/admin/users | Low | Create user account |
| PATCH /api/admin/users/[username] | Low | Update user (enable/disable, admin toggle) |
| DELETE /api/admin/users/[username] | Low | Delete user |
| GET /api/admin/settings | Low | Get system settings |
| PATCH /api/admin/settings | Low | Update system settings |
| GET /api/admin/settings/roles | Low | Get default role permissions |
| PATCH /api/admin/settings/roles | Low | Update default role permissions |
| POST /api/admin/database/export | Low | Export database |
| POST /api/admin/database/import | Low | Import database |
| POST /api/admin/database/wipe | Low | Wipe database |
| POST /api/admin/database/wipe-projects | Low | Wipe all projects |

*Note: Admin operations are intentionally not exposed via MCP for security reasons. The `list_users` tool is an exception to enable user lookup for assigning tickets.

---

### 9. User Profile (Self-service)

#### Currently NOT Available in MCP

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| GET /api/me | Low | Get current user profile |
| PATCH /api/me | Low | Update profile |
| PATCH /api/me/email | Low | Update email |
| PATCH /api/me/password | Low | Change password |
| POST /api/me/avatar | Low | Upload avatar |
| DELETE /api/me/avatar | Low | Delete avatar |
| DELETE /api/me/account | Low | Delete own account |
| GET /api/me/verification-status | Low | Get email verification status |
| GET /api/me/mcp-key | Low | Get MCP key status |
| POST /api/me/mcp-key | Low | Generate new MCP key |
| DELETE /api/me/mcp-key | Low | Revoke MCP key |

---

### 10. Authentication

#### Currently NOT Available in MCP (By Design)

All authentication endpoints now exist in the API. They are intentionally excluded from MCP.

| API Endpoint | Notes |
|--------------|-------|
| POST /api/auth/register | Public registration |
| POST /api/auth/verify-credentials | Credential validation |
| POST /api/auth/forgot-password | Password reset request (rate limited, constant-time response) |
| GET/POST /api/auth/reset-password | Validate token / complete reset |
| POST /api/auth/send-verification | Send verification email |
| POST /api/auth/verify-email | Verify email |

*Note: Authentication endpoints are not needed in MCP as the MCP uses API key authentication.*

---

### 11. Utility/Misc Endpoints

#### Currently NOT Available in MCP

| API Endpoint | Priority | Description |
|--------------|----------|-------------|
| GET /api/dashboard/stats | Low | Dashboard statistics (open/in-progress/completed counts) |
| GET /api/branding | Low | Get branding settings (app name, logo) |
| GET /api/upload | Low | Get upload config |
| POST /api/upload | Low | Upload file |

---

## Inconsistencies Found

### 1. Direct Database Access in MCP Tools

The following MCP tools bypass the API and query the database directly:

- `list_members` in `members.ts` - Uses `db.project.findUnique()` instead of API
- `list_columns` in `columns.ts` - Uses `db.project.findUnique()` instead of API
- `list_users` in `members.ts` - Uses `db.user.findMany()` instead of API
- `add_member`, `remove_member`, `change_member_role` - Query DB for validation, then call API

**Risk:** Bypasses API authorization checks. Should be refactored to use API endpoints consistently.

### 2. Label Update Workaround

The `update_label` MCP tool deletes and recreates labels instead of using a proper PATCH endpoint. This causes:
- Loss of label ID (tickets need to be re-linked)
- Potential data inconsistency during the delete/create window

**Recommendation:** Add PATCH /api/projects/[projectId]/labels/[labelId] endpoint.

### 3. Missing API for Direct Ticket Fetch by Number

The MCP `get_ticket` function fetches all tickets then filters client-side. The API should support:
- GET /api/projects/[projectId]/tickets/by-number/[number]

Or the existing endpoint could support query params:
- GET /api/projects/[projectId]/tickets?number=123

---

## Recommendations

### High Priority
1. **Add attachment management MCP tools** - `list_attachments`, `add_attachment`, `remove_attachment`
2. **Refactor direct DB calls** - `list_members`, `list_columns`, `list_users` should use API
3. **Add label update API** - Proper PATCH endpoint for labels

### Medium Priority
4. **Add extend_sprint MCP tool** - Expose POST /api/projects/[projectId]/sprints/[sprintId]/extend
5. **Add roles management MCP tools** - CRUD operations for project roles
6. **Add ticket search MCP tool** - Expose the search endpoint for better performance
7. **Add ticket-by-number API endpoint** - Avoid fetching all tickets to get one

### Low Priority
8. **Add sprint settings MCP tools** - Get/update sprint configuration
9. **Add dashboard stats MCP tool** - Useful for reporting
10. **Add comment CRUD API and MCP tools** - Enable ticket discussion via MCP

### Not Recommended for MCP
- Admin user management (security concern)
- Database export/import/wipe (destructive operations)
- Authentication endpoints (uses API key auth)
- User profile endpoints (self-service, not needed in automation)

---

## API Routes Summary

| Category | API Routes | MCP Coverage | Gap |
|----------|------------|--------------|-----|
| Tickets | 8 endpoints | 6 tools | Search, attachments, links missing from MCP |
| Sprints | 8 endpoints | 7 tools | Extend, settings missing |
| Labels | 3 endpoints | 5 tools* | Update workaround needs fix |
| Projects | 3 endpoints | 5 tools | Good coverage |
| Members | 3 endpoints | 4 tools | Direct DB access issue |
| Columns | 4 endpoints | 5 tools | Direct DB access issue |
| Roles | 5 endpoints | 0 tools | API exists, MCP tools not implemented |
| Admin | 15 endpoints | 0 tools | By design |
| User Profile | 11 endpoints | 0 tools | Not needed |
| Auth | 8 endpoints | 0 tools | By design |
| Utility | 4 endpoints | 0 tools | Low priority |

*Labels has 5 MCP tools but only 3 API endpoints because add/remove label from ticket goes through ticket update API.

---

## Appendix: Full API Route Inventory

### /api/admin/
- database/export (POST)
- database/import (POST)
- database/wipe (POST)
- database/wipe-projects (POST)
- settings (GET, PATCH)
- settings/email/test (POST)
- settings/logo (POST, DELETE)
- settings/roles (GET, PATCH)
- users (GET, POST)
- users/[username] (GET, PATCH, DELETE)

### /api/auth/
- [...nextauth] (GET, POST)
- forgot-password (POST)
- register (POST)
- reset-password (POST)
- send-verification (POST)
- verify-credentials (POST)
- verify-email (POST)

### /api/me/
- (GET, PATCH)
- account (DELETE)
- avatar (POST, DELETE)
- email (PATCH)
- mcp-key (GET, POST, DELETE)
- password (PATCH)
- verification-status (GET)

### /api/projects/
- (GET, POST)
- events (GET - SSE)
- [projectId] (GET, PATCH, DELETE)
- [projectId]/available-users (GET)
- [projectId]/columns (GET, POST)
- [projectId]/columns/[columnId] (GET, PATCH, DELETE)
- [projectId]/events (GET - SSE)
- [projectId]/labels (GET, POST)
- [projectId]/labels/[labelId] (DELETE)
- [projectId]/members (GET, POST)
- [projectId]/members/[memberId] (PATCH, DELETE)
- [projectId]/my-permissions (GET)
- [projectId]/roles (GET, POST)
- [projectId]/roles/[roleId] (GET, PATCH, DELETE)
- [projectId]/roles/reorder (POST)
- [projectId]/sprints (GET, POST)
- [projectId]/sprints/active (GET)
- [projectId]/sprints/settings (GET, PATCH)
- [projectId]/sprints/[sprintId] (GET, PATCH, DELETE)
- [projectId]/sprints/[sprintId]/complete (POST)
- [projectId]/sprints/[sprintId]/extend (POST)
- [projectId]/sprints/[sprintId]/start (POST)
- [projectId]/tickets (GET, POST)
- [projectId]/tickets/search (GET)
- [projectId]/tickets/[ticketId] (GET, PATCH, DELETE)
- [projectId]/tickets/[ticketId]/attachments (GET, POST)
- [projectId]/tickets/[ticketId]/attachments/[attachmentId] (DELETE)
- [projectId]/tickets/[ticketId]/links (GET, POST)
- [projectId]/tickets/[ticketId]/links/[linkId] (DELETE)

### /api/
- branding (GET)
- dashboard/stats (GET)
- upload (GET, POST)
- users/events (GET - SSE)
