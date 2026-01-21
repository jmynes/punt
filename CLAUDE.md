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

# Linting (Biome)
pnpm lint             # Check for issues
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format code
```

## Architecture

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
- `GET/POST /api/admin/users` - List/create users (with filtering/sorting)
- `GET/PATCH/DELETE /api/admin/users/[userId]` - Manage user (self-demotion prevented)
- `GET/PATCH /api/admin/settings` - System settings (upload limits, allowed file types)

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
- `user.updated`

**Key files:**
- `src/lib/events.ts` - In-memory event emitter with `subscribeToProject()`, `emitTicketEvent()`, `emitProjectEvent()`, `emitLabelEvent()`
- Events include `tabId` (via `X-Tab-Id` header) to skip echoing back to originating client
- 30-second keepalive comments prevent connection timeout
- `X-Accel-Buffering: no` header disables nginx buffering

### State Management (Zustand)

All client-side state lives in Zustand stores with localStorage persistence:

- **board-store**: Kanban columns/tickets per project. Key pattern: `projects: Record<projectId, ColumnWithTickets[]>`. Use `getColumns(projectId)` to access. Custom date revival on hydration. Validates localStorage data structure during rehydration to prevent crashes from corrupted data.
- **backlog-store**: Backlog view config (15 columns, multi-filter support, sorting). Filters by type/priority/status/assignee/labels/sprint/story-points/due-date.
- **sprint-store**: Sprint-related state for sprint planning view.
- **undo-store**: Undo/redo stack for all reversible actions (delete, move, paste, update, ticketCreate, projectCreate/Delete). Each action has `toastId` for UI feedback.
- **admin-undo-store**: Separate undo/redo for admin operations (user management).
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
- **Backlog**: `BacklogTable` with configurable columns, sorting headers, filtering dropdowns.
- **Sprints**: `SprintList`, `SprintCard`, `SprintCreateDialog`, `SprintStartDialog`, `SprintCompleteDialog`, `CarryoverBadge`.
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
│   │   └── sprints/        # Sprint planning view
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
│   ├── backlog/            # Table view
│   ├── board/              # Kanban (dnd-kit)
│   ├── common/             # Shared components (avatars, badges, etc.)
│   ├── layout/             # Sidebar, header, navigation
│   ├── profile/            # Profile editing
│   ├── projects/           # Project cards, forms
│   ├── sprints/            # Sprint components
│   ├── tickets/            # Ticket dialogs, forms
│   └── ui/                 # shadcn/ui
├── generated/              # Prisma-generated client (auto-generated)
├── stores/                 # Zustand stores
├── hooks/                  # useCurrentUser, useMediaQuery, queries/
├── lib/                    # auth.ts, password.ts, rate-limit.ts, db.ts, logger.ts, api-utils.ts, constants.ts
│   ├── actions/            # Unified action modules (paste-tickets.ts, delete-tickets.ts)
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

### Debugging

- Logger: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.measure()`
- Enable via `NEXT_PUBLIC_DEBUG=true`
- Window globals in dev: `window.boardStore`, `window.undoStore`
