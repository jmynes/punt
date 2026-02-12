# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PUNT (Project Unified Nimble Tracker) is a local-first ticketing system with Jira-like backlog + Kanban board. Built with Next.js 16 (App Router), React 19, TypeScript, SQLite/Prisma, Zustand for state management, and NextAuth.js v5 for authentication.

## Commands

```bash
# Development
pnpm dev              # Start dev server with Turbopack (port 3000)

# Database
pnpm db:generate      # Generate Prisma client after schema changes
pnpm db:push          # Push schema to SQLite
pnpm db:migrate       # Create migration + push
pnpm db:studio        # Visual database browser

# Testing
pnpm test             # Run tests once
pnpm test:watch       # Watch mode
pnpm test -- src/stores/__tests__/board-store.test.ts  # Run single test file

# Linting (Biome) - enforced via pre-commit hooks
pnpm lint             # Check for issues
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format code
```

### Linting Enforcement

Biome linting is enforced automatically:

- **Pre-commit hooks**: husky + lint-staged runs `biome check --write` on staged JS/TS/JSON files before each commit. Commits fail if unfixable errors exist.
- **VS Code integration**: `.vscode/settings.json` configures Biome as default formatter with format-on-save and auto-organize imports. `.vscode/extensions.json` recommends the Biome extension.
- **Auto-setup**: The `"prepare": "husky"` script initializes hooks on `pnpm install`.

Key files:
- `biome.json` - Biome configuration (recommended rules, formatting options)
- `.husky/pre-commit` - Pre-commit hook script
- `.vscode/settings.json` - VS Code editor settings
- `.vscode/extensions.json` - Recommended extensions

## Architecture

### Demo Mode

When `NEXT_PUBLIC_DEMO_MODE=true`, the app runs entirely client-side:
- No database connection required
- All data stored in localStorage (prefixed with `punt-demo-`)
- Auto-authenticated as a demo user with admin privileges
- Uses `DemoDataProvider` instead of `APIDataProvider`

**Key files:**
- `src/lib/demo/demo-config.ts` - Demo mode detection (`isDemoMode()`) and demo user definitions
- `src/lib/demo/demo-storage.ts` - localStorage-based data storage
- `src/lib/demo/demo-data.ts` - Initial demo data (projects, tickets, sprints)
- `src/lib/data-provider/demo-provider.ts` - DataProvider implementation for demo mode
- `src/lib/data-provider/api-provider.ts` - DataProvider implementation for production (API calls)
- `src/lib/data-provider/index.ts` - Factory function `getDataProvider()` that returns the appropriate provider

**Data Provider Pattern:**
All data operations go through the `DataProvider` interface, which abstracts whether data comes from the API or localStorage. Components use React Query hooks (`src/hooks/queries/`) that internally call `getDataProvider()`.

### Authentication (NextAuth.js v5)

**Key files:**
- `src/lib/auth.ts` - Main NextAuth config with credentials provider
- `src/lib/auth.config.ts` - Edge-compatible config for middleware
- `src/middleware.ts` - Route protection (redirects to `/login`)
- `src/lib/auth-helpers.ts` - Server-side utilities: `getCurrentUser()`, `requireAuth()`, `requireSystemAdmin()`, `requireProjectMember()`, `requireProjectAdmin()`, `requireProjectOwner()`
- `src/lib/url-validation.ts` - Safe redirect URL validation (`isValidRedirectUrl()`, `getSafeRedirectUrl()`)

**Flow:**
- Credentials provider with Zod validation (username/email + password)
- bcryptjs hashing (12 salt rounds) via `src/lib/password.ts`
- JWT session strategy with tokens in HTTP-only cookies
- Session/Account models in database via `@auth/prisma-adapter`
- `isActive` flag checked before login (soft delete mechanism)
- `passwordChangedAt` field invalidates sessions after password change

**Protected routes:** All routes except `/api/auth/*`, `/login`, `/register`, `/invite`. Middleware redirects unauthenticated users to `/login?callbackUrl={path}`.

**Client hooks** (`src/hooks/use-current-user.ts`):
- `useCurrentUser()` - Returns `UserSummary | null`
- `useIsAuthenticated()` - Returns `{ isAuthenticated, isLoading }`
- `useIsSystemAdmin()` - Returns `{ isSystemAdmin, isLoading }`

**Permission hooks** (`src/hooks/use-permissions.ts`):
- `useMyPermissions(projectId)` - Returns `{ permissions, isLoading }` for current user
- `useHasPermission(projectId, permission)` - Returns `boolean | undefined` (undefined while loading)
- `useHasAnyPermission(projectId, permissions[])` - Returns `boolean | undefined`
- Used in project settings page to wait for permissions before showing content (avoids "Access Denied" flash)

**Password requirements:** Min 12 chars, 1 uppercase, 1 lowercase, 1 number.

**Project authorization** (`src/lib/auth-helpers.ts`):
- `requireProjectMember(userId, projectId)` - Requires any project membership
- `requireProjectAdmin(userId, projectId)` - Requires admin or owner role
- `requireProjectOwner(userId, projectId)` - Requires owner role only
- Used in `/api/projects/[projectId]` routes: GET requires member, PATCH requires admin, DELETE requires owner

### API Routes

**Auth:**
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `POST /api/auth/register` - Public registration (rate limited: 5/hour)
- `POST /api/auth/verify-credentials` - Credential validation helper

**User profile (`/api/me`):**
- `GET/PATCH /api/me` - Get/update profile (name)
- `PATCH /api/me/email` - Update email (requires password)
- `PATCH /api/me/password` - Change password (rate limited: 5/15min)
- `POST/DELETE /api/me/avatar` - Upload/delete avatar (WebP conversion, metadata stripping)
- `DELETE /api/me/account` - Hard delete account (requires password + confirmation string)

**Projects:**
- `GET/POST /api/projects` - List/create projects
- `GET/PATCH/DELETE /api/projects/[projectId]` - Manage project (member/admin/owner required)
- `GET /api/projects/[projectId]/columns` - List columns (auto-creates defaults if none)
- `GET /api/projects/[projectId]/members` - List project members

**Tickets:**
- `GET/POST /api/projects/[projectId]/tickets` - List/create tickets
- `GET/PATCH/DELETE /api/projects/[projectId]/tickets/[ticketId]` - Manage ticket
- Ticket fields: title, description, type, priority, columnId, assigneeId, sprintId, parentId, storyPoints, estimate, startDate, dueDate, environment, affectedVersion, fixVersion, labelIds, watcherIds

**Attachments:**
- `GET/POST /api/projects/[projectId]/tickets/[ticketId]/attachments` - List/add attachments
- `DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments/[attachmentId]` - Remove attachment

**Labels:**
- `GET/POST /api/projects/[projectId]/labels` - List/create labels (auto-color assignment)
- `DELETE /api/projects/[projectId]/labels/[labelId]` - Delete label

**Sprints:**
- `GET/POST /api/projects/[projectId]/sprints` - List/create sprints
- `GET/PATCH/DELETE /api/projects/[projectId]/sprints/[sprintId]` - Manage sprint
- `POST /api/projects/[projectId]/sprints/[sprintId]/start` - Start sprint (planning → active)
- `POST /api/projects/[projectId]/sprints/[sprintId]/complete` - Complete sprint with carryover options
- `POST /api/projects/[projectId]/sprints/[sprintId]/extend` - Extend active sprint
- `GET /api/projects/[projectId]/sprints/active` - Get active sprint
- `GET/PATCH /api/projects/[projectId]/sprints/settings` - Sprint settings (default duration, auto-carryover, done columns)

**Admin (`/api/admin`) - requires `isSystemAdmin`:**
- `GET/POST /api/admin/users` - List/create users (with filtering/sorting, requires password confirmation)
- `GET/PATCH/DELETE /api/admin/users/[userId]` - Manage user (self-demotion prevented)
- `GET/PATCH /api/admin/settings` - System settings (upload limits, allowed file types)
- `POST /api/admin/database/export` - Export database (requires password confirmation)
- `POST /api/admin/database/import` - Import database backup (requires password confirmation, replaces all data)
- `POST /api/admin/database/wipe` - Wipe entire database, create new admin (requires password confirmation)
- `POST /api/admin/database/wipe-projects` - Wipe all projects, keep users (requires password confirmation)

**File Upload:**
- `GET/POST /api/upload` - Get config/upload files (validates type/size against SystemSettings)

**Real-time Events (SSE):**
- `GET /api/projects/[projectId]/events` - Project events (ticket/label CRUD)
- `GET /api/projects/events` - Project list events
- `GET /api/users/events` - User profile events

**Rate limiting** (`src/lib/rate-limit.ts`): Database-backed per client identifier. Limits: login 10/15min, register 5/hour, password change 5/15min.
- Client identification: Uses `TRUST_PROXY=true` env var to trust `X-Forwarded-For` headers (only enable behind trusted reverse proxy)
- Without `TRUST_PROXY`, uses browser fingerprint hash (user-agent + accept-language) to prevent header spoofing bypasses

### Real-time Events (SSE)

Events are broadcast via Server-Sent Events for multi-tab/multi-user sync.

**Event types:**
- `ticket.created`, `ticket.updated`, `ticket.moved`, `ticket.deleted`
- `label.created`, `label.deleted`
- `project.created`, `project.updated`, `project.deleted`
- `member.added`, `member.removed`, `member.role.updated` - Project membership changes
- `user.updated`
- `database.wiped` - Full database wipe or import (forces sign out on all tabs)
- `database.projects.wiped` - All projects wiped (invalidates all queries)

**Key files:**
- `src/lib/events.ts` - In-memory event emitter with `subscribeToProject()`, `emitTicketEvent()`, `emitProjectEvent()`, `emitLabelEvent()`, `emitMemberEvent()`, `emitDatabaseEvent()`
- Events include `tabId` (via `X-Tab-Id` header) to skip echoing back to originating client
- 30-second keepalive comments prevent connection timeout
- `X-Accel-Buffering: no` header disables nginx buffering

### State Management (Zustand)

All client-side state lives in Zustand stores with localStorage persistence:

- **board-store**: Kanban columns/tickets per project. Key pattern: `projects: Record<projectId, ColumnWithTickets[]>`. Use `getColumns(projectId)` to access. `updateTickets()` for atomic batch updates (prevents visual glitches during undo/redo). Custom date revival on hydration. Validates localStorage data structure during rehydration to prevent crashes from corrupted data.
- **backlog-store**: Backlog view config (15 columns, multi-filter support, sorting). Filters by type/priority/status/assignee/labels/sprint/story-points/due-date.
- **sprint-store**: Sprint-related state for sprint planning view.
- **undo-store**: Undo/redo stack for all reversible actions (delete, move, paste, update, ticketCreate, projectCreate/Delete). Each action has `toastId` for UI feedback.
- **admin-undo-store**: Separate undo/redo for admin operations. Handles user management (enable/disable, admin toggle) and project member operations (add, remove, role changes). Supports both single and bulk operations with Ctrl+Z/Y keyboard shortcuts.
- **selection-store**: Multi-select with `selectedTicketIds: Set<string>`, clipboard via `copiedTicketIds`, and `ticketOrigins` map for arrow key navigation.
- **projects-store**: Project list with sequential numeric ID generation.
- **ui-store**: Modal/drawer/sidebar visibility states and `prefillTicketData` for form pre-population.
- **settings-store**: User preferences and UI settings.

Stores use `_hasHydrated` flag to prevent render before localStorage loads.

### Database (Prisma + SQLite)

Schema in `prisma/schema.prisma`. Key models:

**Core:**
- **User**: username (unique), email (unique, optional), name, avatar, passwordHash, passwordChangedAt, isSystemAdmin, isActive. Related: Session, Account, Invitation.
- **Session**: Server-side session storage with userAgent, ipAddress, lastActive.
- **Account**: OAuth provider linkage (future-proofed for Google, GitHub).
- **RateLimit**: Tracks rate limits per IP/endpoint.

**Projects:**
- **Project**: name, key (unique), description, color. Relations: columns, tickets, members, labels, sprints, invitations, sprintSettings.
- **ProjectMember**: User-project relationship with role (owner, admin, member).
- **Column**: Board columns with order field.

**Tickets:**
- **Ticket**: 25+ fields including type/priority/order/storyPoints/estimate/dates/versions. Unique constraint on `[projectId, number]` for ticket keys (e.g., PUNT-1). Supports parentId for subtasks, isCarriedOver/carriedFromSprintId/carriedOverCount for sprint tracking.
- **Label**: Project-scoped with name/color. Unique constraint: `[projectId, name]`.
- **TicketWatcher**: Many-to-many user-ticket relationship.
- **TicketLink**: Ticket relationships (blocks, is_blocked_by, relates_to, duplicates, is_duplicated_by, clones, is_cloned_by).
- **Comment**: Ticket comments with author.
- **Attachment**: File attachments with filename, mimeType, size, url.
- **TicketEdit**: Edit history tracking field changes.

**Sprints:**
- **Sprint**: name, goal, startDate, endDate, status (planning/active/completed), completion metrics (completedTicketCount, incompleteTicketCount, completedStoryPoints, incompleteStoryPoints).
- **TicketSprintHistory**: Tracks ticket entry/exit from sprints with entryType (added/carried_over) and exitStatus (completed/carried_over/removed).
- **ProjectSprintSettings**: Per-project settings (defaultSprintDuration, autoCarryOverIncomplete, doneColumnIds).

**System:**
- **Invitation**: Project invitations with token, role, status, expiration.
- **SystemSettings**: Singleton for upload config (max sizes, allowed MIME types).

Types generated to `@/generated/prisma/client`, re-exported with relations from `@/types/index.ts`.

### Component Patterns

- **Auth**: `LoginForm` uses `signIn('credentials')`, `RegisterForm` calls `/api/auth/register` then auto-signs in.
- **Admin**: `UserList` with React Query, admin toggle (self-prevention), enable/disable users. `AdminSettingsForm` for upload config.
- **Profile**: `AvatarUpload`, `ProfileForm`, `PasswordChange` components.
- **Board**: `KanbanBoard` orchestrates dnd-kit with `KanbanColumn` and `KanbanCard`. Multi-select drag shows overlay.
- **Table**: Unified table components in `src/components/table/` shared by backlog and sprint views:
  - `TicketTable` - Main table component with drag-and-drop support
  - `TicketTableRow` - Row with selection (click/Ctrl/Shift), keyboard nav, drag state
  - `TicketTableHeader` - Sortable column headers
  - `TicketCell` - Cell renderer for all 15 column types
  - `DropIndicator` - Visual drop target indicator
- **Backlog**: `BacklogTable` wraps `TicketTable` with filtering, sorting, and column configuration.
- **Sprints**: `SprintSection` wraps `TicketTable`. Also: `SprintList`, `SprintCard`, `SprintCreateDialog`, `SprintStartDialog`, `SprintCompleteDialog`, `CarryoverBadge`.
- **Tickets**: `TicketForm` with comprehensive fields, `TypeSelect`, `PrioritySelect`, `CustomImageDialog`.
- **UI**: shadcn/ui components in `src/components/ui/`.

### Provider Stack (`src/components/providers.tsx`)

```
SessionProvider (NextAuth)
  └─ QueryClientProvider (React Query - 1min stale time)
       └─ TooltipProvider (Radix)
```

### Key Patterns

- **Optimistic updates**: Store updates happen immediately; before-drag snapshots saved for undo.
- **Multi-select**: Click=single, Shift+Click=range, Ctrl/Cmd+Click=toggle. `lastSelectedId` tracks range anchor.
- **Undo/Redo**: Action-centric with project-scoped entries. Toast buttons trigger undo.
- **Soft deletes**: Users have `isActive` flag instead of hard deletion.
- **File storage abstraction**: `FileStorage` interface (`src/lib/file-storage.ts`) with `FilesystemStorage` (production) and `InMemoryStorage` (testing). Storage instance managed via `src/lib/upload-storage.ts` with `getFileStorage()`/`setFileStorage()` for test injection.
- **Upload security**: SVG files blocked (XSS risk via embedded scripts). Allowed types: JPEG, PNG, GIF, WebP, MP4, WebM, OGG, QuickTime, PDF, Word, Excel, TXT, CSV.
- **Sprint carryover**: Incomplete tickets can be moved to next sprint, backlog, or kept in completed sprint. Carryover tracking via isCarriedOver, carriedFromSprintId, carriedOverCount fields.

### File Organization

```
src/
├── app/                    # Next.js pages + API routes
│   ├── (auth)/             # Login/register pages (route group)
│   ├── admin/              # Admin pages (users/, settings/)
│   ├── profile/            # User profile page
│   ├── projects/[projectId]/
│   │   ├── board/          # Kanban board view
│   │   ├── backlog/        # Backlog table view
│   │   ├── sprints/        # Sprint planning view
│   │   └── settings/       # Project settings (general, members, roles)
│   ├── settings/           # Settings page
│   ├── api/auth/           # NextAuth + register
│   ├── api/me/             # User profile endpoints
│   ├── api/admin/          # Admin endpoints (users/, settings/)
│   ├── api/projects/       # Project CRUD + nested resources
│   │   └── [projectId]/
│   │       ├── columns/    # Column endpoints
│   │       ├── members/    # Member endpoints
│   │       ├── tickets/    # Ticket CRUD + attachments
│   │       ├── labels/     # Label endpoints
│   │       ├── sprints/    # Sprint endpoints + actions
│   │       └── events/     # SSE endpoint
│   └── api/upload/         # File upload
├── components/
│   ├── admin/              # User management, settings
│   ├── auth/               # Login/register forms
│   ├── backlog/            # Backlog view (uses table/)
│   ├── board/              # Kanban (dnd-kit)
│   ├── common/             # Shared components (avatars, badges, etc.)
│   ├── layout/             # Sidebar, header, navigation
│   ├── profile/            # Profile editing
│   ├── projects/           # Project cards, forms, settings
│   │   └── permissions/    # Members tab, roles tab, role compare dialog
│   ├── sprints/            # Sprint view (uses table/)
│   ├── table/              # Unified table components (TicketTable, TicketTableRow, TicketCell)
│   ├── tickets/            # Ticket dialogs, forms
│   └── ui/                 # shadcn/ui
├── generated/              # Prisma-generated client (auto-generated)
├── stores/                 # Zustand stores
├── hooks/                  # useCurrentUser, useMediaQuery, queries/
├── lib/                    # auth.ts, password.ts, rate-limit.ts, db.ts, logger.ts, api-utils.ts, constants.ts
│   ├── actions/            # Unified action modules (paste-tickets.ts, delete-tickets.ts)
│   ├── data-provider/      # DataProvider abstraction (api-provider.ts, demo-provider.ts)
│   ├── demo/               # Demo mode (demo-config.ts, demo-storage.ts, demo-data.ts)
│   ├── events.ts           # SSE event emitter
│   ├── sprint-utils.ts     # Sprint helpers (generateNextSprintName, isCompletedColumn)
│   └── system-settings.ts  # Dynamic upload config
└── types/                  # Prisma re-exports + custom types
```

### Testing

Vitest + React Testing Library + MSW for API mocking. Tests colocated in `__tests__/` subdirectories. Use custom render from `@/__tests__/utils/test-utils`. `InMemoryStorage` for file upload tests. Coverage target: 80% minimum, 90% for stores/API/utils.

### Security

**Authentication & Authorization:**
- Project IDOR protection: All `/api/projects/[projectId]` routes verify membership via `requireProjectMember/Admin/Owner()`
- Password hashing: bcryptjs with 12 salt rounds
- JWT sessions in HTTP-only cookies
- Session invalidation on password change (passwordChangedAt field)
- Soft delete with `isActive` flag (disabled users can't login)
- Admin self-demotion and sole admin deletion prevention

**Input Validation:**
- Open redirect prevention: `callbackUrl` validated via `getSafeRedirectUrl()` - only relative paths allowed
- Rate limiting: Database-backed, client fingerprinting when `TRUST_PROXY=false`
- Registration race condition handling: Prisma P2002 unique constraint errors return 400 (not 500)
- Zod schemas on all API payloads
- Username validation: 3-30 chars, alphanumeric/dash/underscore, Unicode NFC normalization

**File Upload:**
- SVG blocked (XSS via embedded scripts)
- File type whitelist + size limits per type (configurable via SystemSettings)
- Unique filenames generated server-side (timestamp + random)
- Avatar images: resize, metadata stripping, WebP conversion
- Max 20 attachments per ticket (configurable)

**Client-side:**
- localStorage validation during hydration prevents crashes from corrupted data

### API Utilities (`src/lib/api-utils.ts`)

Centralized API response helpers to reduce duplication across routes:
- `handleApiError(error, action)` - Standardized error handling for catch blocks
- `validationError(result)` - Zod validation failure response
- `rateLimitExceeded(rateLimit)` - Rate limit response with headers
- `notFoundError(resource)` - 404 response
- `badRequestError(message)` - 400 response
- `passwordValidationError(errors)` - Password validation failure

### Prisma Selects (`src/lib/prisma-selects.ts`)

Shared Prisma select clauses to avoid duplication:
- `TICKET_SELECT_FULL` - Full ticket with all relations
- `SPRINT_SELECT_FULL` - Full sprint with tickets and history
- `USER_SELECT_SUMMARY` - User summary (id, name, email, avatar)
- `USER_SELECT_ADMIN_LIST` - User for admin listing
- `LABEL_SELECT` - Label full selection
- `transformTicket(ticket)` - Flatten watchers relation

### Sprint Utilities (`src/lib/sprint-utils.ts`)

- `generateNextSprintName(currentName)` - Generate incremented sprint name (Sprint 1 → Sprint 2)
- `isCompletedColumn(columnName)` - Heuristic for identifying done columns

### System Settings (`src/lib/system-settings.ts`)

- `getSystemSettings()` - Fetch from DB with defaults
- `getUploadConfig()` - Get upload limits and allowed types
- `getFileCategoryForMimeType(mimeType, settings)` - Categorize file (image/video/document)
- `getMaxSizeForMimeType(mimeType, settings)` - Get max size limit for file type

### Action Modules (`src/lib/actions/`)

Unified action implementations for consistent behavior across UI triggers (context menu, keyboard shortcuts, drawer). Each action handles:
- Optimistic updates for immediate UI feedback
- API persistence with rollback on error
- Undo/redo support with toast integration
- Selection management

Available actions:
- `pasteTickets({ projectId, columns, options?, onComplete? })` - Paste copied tickets
- `deleteTickets({ projectId, tickets, options?, onComplete? })` - Delete tickets with undo

### MCP Server

PUNT includes an MCP (Model Context Protocol) server for conversational ticket management. Located in `mcp/`.

**Architecture:** The MCP server calls PUNT's API endpoints (not direct Prisma), enabling:
- **Real-time SSE updates**: Changes made via MCP appear instantly in the UI without refresh
- **Per-user authentication**: Each user generates their own API key via `POST /api/me/mcp-key`
- **Consistent permissions**: MCP requests use the same authorization as web UI

**Authentication:**
1. User generates API key: `POST /api/me/mcp-key` (requires web auth)
2. Key stored in database (`User.mcpApiKey` field)
3. MCP sends key via `X-MCP-API-Key` header
4. API routes validate key via `getMcpUser()` in `auth-helpers.ts`

**Querying conventions:**
- **All tickets are in scope by default.** Do not assume only "To Do", backlog, or active sprint unless the user explicitly scopes the query (e.g. "in the current sprint", "in the backlog", "To Do tickets only").
- When applying filters, state which filters were used so the user knows what was included/excluded.
- When auditing or reviewing tickets (e.g. checking for missing fields, evaluating points), query all columns and statuses — not just To Do.
- Use your best judgement to scope queries when context makes it obvious (e.g. "what's left to do" implies non-Done tickets), but be transparent about it.

**Available tools (31 total):**
| Category | Tools |
|----------|-------|
| Tickets | `get_ticket`, `list_tickets`, `create_ticket`, `update_ticket`, `move_ticket`, `delete_ticket` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Sprints | `list_sprints`, `get_sprint`, `create_sprint`, `update_sprint`, `start_sprint`, `complete_sprint`, `delete_sprint` |
| Members | `list_members`, `add_member`, `remove_member`, `change_member_role`, `list_users` |
| Labels | `list_labels`, `create_label`, `update_label`, `delete_label`, `add_label_to_ticket`, `remove_label_from_ticket` |
| Columns | `list_columns`, `create_column`, `rename_column`, `reorder_column`, `delete_column` |

**Key files:**
- `mcp/src/index.ts` - Server entry point, tool registrations
- `mcp/src/api-client.ts` - HTTP client for PUNT API calls
- `mcp/src/tools/tickets.ts` - Ticket CRUD tools
- `mcp/src/tools/projects.ts` - Project/member/column tools
- `mcp/src/tools/sprints.ts` - Sprint lifecycle tools
- `mcp/src/tools/labels.ts` - Label management tools
- `mcp/src/utils.ts` - Formatting helpers (markdown output)

**Environment:**
- `MCP_API_KEY` - User's API key (from `/api/me/mcp-key`)
- `MCP_BASE_URL` - PUNT server URL (default: `http://localhost:3000`)

**Prerequisites for full workflow:**
- `pnpm dev` running on port 3000 (MCP calls the PUNT API)
- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated — used for PR creation, merging, and issue management
- Git configured for the repository

**Running the MCP server:**
```bash
cd mcp && pnpm install  # First time only
MCP_API_KEY=your-key pnpm --dir mcp exec tsx src/index.ts
```

**Configuration** (`.mcp.json` — gitignored, contains secrets):

The `.mcp.json` file lives in the project root but is **gitignored** because it contains the API key. Claude Code reads it automatically per-project. The MCP server requires the dev server (`pnpm dev`) to be running on port 3000, since it calls the PUNT API. If MCP tools return HTML instead of JSON, the dev server is not running.

```json
{
  "mcpServers": {
    "punt": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "mcp", "exec", "tsx", "src/index.ts"],
      "env": {
        "MCP_API_KEY": "<user's key from POST /api/me/mcp-key>"
      }
    }
  }
}
```

**Parallel subagents must use git worktrees:** When launching multiple Claude Code subagents in parallel, each must work in its own git worktree to avoid branch-switching conflicts. Without this, agents overwrite each other's file changes and cause linter/commit failures.
```bash
git worktree add /tmp/worktree-<branch-name> -b <branch-name> main
cd /tmp/worktree-<branch-name>
# Do all work here, then commit, push, and create PR from this directory
```

**Use `??` (nullish coalescing), not `||`:** For values where `0`, `false`, or empty string are valid, always use `??`. Example: `storyPoints ?? null` not `storyPoints || null` (the latter silently discards `0`).

### Branch & PR Naming Convention

**Branch names:** `type/punt-N-short-description`
- Examples: `fix/punt-50-context-menu-click-passthrough`, `feat/punt-12-sprint-planning`, `docs/punt-51-branch-pr-naming-convention`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

**PR titles:** Include the ticket key in the title.
- Format: `type(scope): description (PUNT-N)`
- Examples: `fix(board): resolve context menu click passthrough (PUNT-50)`, `feat(sprints): add sprint planning view (PUNT-12)`

**Commit messages:** Same convention as PR titles when tied to a ticket.

**Branch cleanup after merge:** GitHub is configured to auto-delete remote branches when a PR is merged (`delete_branch_on_merge` enabled). After merging, clean up the local branch:
```bash
git checkout main && git pull && git branch -d <branch-name>
```

**PR merging:** Do NOT merge PRs without explicitly asking the user first. Always present the PR for review and wait for approval before merging.

### Debugging

- Logger: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.measure()`
- Enable via `NEXT_PUBLIC_DEBUG=true`
- Window globals in dev: `window.boardStore`, `window.undoStore`

### Deployment

**Railway:**
- `railway.toml` configures Nixpacks builder with pnpm
- `.node-version` specifies Node.js 20 (required by Next.js 16)
- Required env vars for demo mode: `NEXT_PUBLIC_DEMO_MODE=true`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `DATABASE_URL` (dummy value for Prisma generation)

**Node.js requirement:** Next.js 16 requires Node.js >= 20.9.0. The `engines` field in `package.json` enforces this.

### Releasing

Releases are automated via GitHub Actions when a version tag is pushed.

**Quick release:**
```bash
pnpm release patch   # 0.1.0 -> 0.1.1
pnpm release minor   # 0.1.0 -> 0.2.0
pnpm release major   # 0.1.0 -> 1.0.0
pnpm release 1.2.3   # Explicit version
```

The `pnpm release` script:
1. Validates you are on the `main` branch with no uncommitted changes
2. Updates `package.json` version
3. Commits the version bump
4. Creates and pushes a git tag (e.g., `v0.2.0`)
5. The tag push triggers the GitHub Actions release workflow

**Manual release process:**
```bash
# 1. Ensure you're on main with a clean working directory
git checkout main && git pull

# 2. Update package.json version
npm version 0.2.0 --no-git-tag-version

# 3. Commit the version bump
git add package.json
git commit -m "chore(release): bump version to 0.2.0"

# 4. Create and push the tag
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main
git push origin v0.2.0
```

**What the release workflow does:**
- Runs lint and tests to ensure the release is stable
- Builds the project
- Verifies `package.json` version matches the tag
- Creates a GitHub release with auto-generated release notes
- Pre-release tags (containing `-alpha`, `-beta`, or `-rc`) are marked as pre-releases

**Key files:**
- `.github/workflows/release.yml` - Release automation workflow
- `scripts/release.js` - Release helper script
