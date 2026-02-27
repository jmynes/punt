# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PUNT (Project Unified Nimble Tracker) is a local-first ticketing system with Jira-like backlog + Kanban board. Built with Next.js 16 (App Router), React 19, TypeScript, PostgreSQL/Prisma, Zustand for state management, and NextAuth.js v5 for authentication.

## Commands

```bash
# Development
pnpm dev              # Start dev server with Turbopack (port 3000)

# Database (PostgreSQL)
pnpm db:generate      # Generate Prisma client after schema changes
pnpm db:push          # Push schema to PostgreSQL
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

Routes follow RESTful conventions in `src/app/api/`. Key categories:

| Category | Path | Notes |
|----------|------|-------|
| Auth | `/api/auth/*` | NextAuth + register, password reset, email verification |
| User | `/api/me/*` | Profile, password, avatar, MCP key |
| Projects | `/api/projects/[projectId]/*` | CRUD + columns, members, roles, tickets, labels, sprints |
| Admin | `/api/admin/*` | Users, settings, database ops (requires `isSystemAdmin`) |
| SSE | `/api/*/events` | Real-time updates for multi-tab/multi-user sync |

**Rate limiting** (`src/lib/rate-limit.ts`): Database-backed. Key limits: login 10/15min, register 5/hour, password change 5/15min.

### Real-time Events (SSE)

Events are broadcast via Server-Sent Events for multi-tab/multi-user sync.

**Event types:**
- `ticket.created`, `ticket.updated`, `ticket.moved`, `ticket.deleted`
- `ticket.link.created`, `ticket.link.deleted` - Ticket relationship changes
- `label.created`, `label.deleted`
- `project.created`, `project.updated`, `project.deleted`
- `member.added`, `member.removed`, `member.role.updated` - Project membership changes
- `user.updated`
- `branding.updated` - Logo/app name changes
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
- **backlog-store**: Backlog view config (21 columns, multi-filter support, sorting, filter button configuration). Filters by type/priority/status/resolution/assignee/labels/sprint/story-points/due-date. Independent filter button visibility and drag-and-drop ordering.
- **sprint-store**: Sprint-related state for sprint planning view.
- **undo-store**: Undo/redo stack for all reversible actions (delete, move, paste, update, ticketCreate, projectCreate/Delete, columnRename, columnDelete, columnCreate). Each action has `toastId` for UI feedback.
- **admin-undo-store**: Separate undo/redo for admin operations. Handles user management (enable/disable, admin toggle) and project member operations (add, remove, role changes). Supports both single and bulk operations with Ctrl+Z/Y keyboard shortcuts.
- **selection-store**: Multi-select with `selectedTicketIds: Set<string>`, clipboard via `copiedTicketIds`, and `ticketOrigins` map for arrow key navigation.
- **projects-store**: Project list with sequential numeric ID generation.
- **ui-store**: Modal/drawer/sidebar visibility states and `prefillTicketData` for form pre-population.
- **settings-store**: User preferences and UI settings.

Stores use `_hasHydrated` flag to prevent render before localStorage loads.

### Database (Prisma + PostgreSQL)

Schema in `prisma/schema.prisma`. Key models: User, Project, Ticket, Sprint, Label, Role, Column.

**Native enums:** TicketType, TicketPriority, SprintStatus, InvitationStatus, InvitationRole, SprintEntryType, SprintExitStatus, LinkType. Resolution is kept as `String?` (contains spaces/apostrophes).

**Json fields:** Role.permissions, ProjectMember.overrides, SystemSettings.defaultRolePermissions, User.totpRecoveryCodes, User.enabledMcpServers, Project.environmentBranches, Project.commitPatterns, ProjectSprintSettings.doneColumnIds, ChatMessage.metadata, SystemSettings.allowedImageTypes/allowedVideoTypes/allowedDocumentTypes. These are native PostgreSQL JSON - no manual `JSON.parse()`/`JSON.stringify()` needed. Use `Prisma.DbNull` (not `null`) when setting a nullable Json field to NULL.

**Case-insensitive usernames:** PostgreSQL uses `findFirst` with `mode: 'insensitive'` instead of the old `usernameLower` column.

Types generated to `@/generated/prisma/client`, re-exported with relations from `@/types/index.ts`.

See `src/lib/prisma-selects.ts` for shared select clauses and `transformTicket()` helper.

### Component Patterns

- **Board**: dnd-kit Kanban with multi-select drag. See `src/components/board/`
- **Table**: Unified `TicketTable` shared by backlog/sprints with selection, keyboard nav, drag-and-drop. See `src/components/table/`
- **Tickets**: `TicketForm` with comprehensive fields, ticket links. See `src/components/tickets/`
- **Permissions**: `RolesTab` with drag-and-drop ordering, `RoleEditorPanel`. See `src/components/projects/permissions/`
- **UI**: shadcn/ui in `src/components/ui/`

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

### PQL (Punt Query Language)

JQL-like query language for advanced ticket filtering. Access via `</>` icon in search bar.

**Syntax examples:**
```
priority = high AND type = bug
assignee IS EMPTY
storyPoints >= 5
created > -7d
(type = bug OR type = task) AND sprint IS NOT EMPTY
```

**Fields:** type, priority, status, assignee, reporter, sprint, labels, storyPoints, dueDate, created, updated, resolution, key, summary (alias: title), description

**Operators:** `=`, `!=`, `>`, `<`, `>=`, `<=`, `IN`, `NOT IN`, `IS EMPTY`, `IS NOT EMPTY`, `AND`, `OR`, `NOT`

**Relative dates:** `-7d` (days), `-2w` (weeks), `-1m` (months), `-1y` (years)

**Key files:** `src/lib/query-parser.ts`, `src/lib/query-evaluator.ts`

### File Organization

```
src/
├── app/           # Next.js pages + API routes
├── components/    # React components by domain (admin, board, backlog, sprints, tickets, table, ui)
├── stores/        # Zustand stores (board, backlog, undo, selection, ui, settings)
├── hooks/         # Custom hooks + React Query wrappers (queries/)
├── lib/           # Core utilities (auth, db, permissions, email, data-provider, actions)
└── types/         # Prisma re-exports + custom types
```

### Testing

Vitest + React Testing Library + MSW. Tests in `__tests__/` subdirectories. See `docs/TESTING.md` for detailed guide.

Coverage target: 80% minimum, 90% for stores/API/utils. Database tests run in separate vitest project to prevent race conditions. Tests require a PostgreSQL test database (see `.env.test`).

### Security

**Authentication & Authorization:**
- Project IDOR protection: All `/api/projects/[projectId]` routes verify membership via granular permissions
- Password hashing: bcryptjs with 12 salt rounds
- JWT sessions in HTTP-only cookies
- Session invalidation on password change (passwordChangedAt field)
- Soft delete with `isActive` flag (disabled users can't login)
- Admin self-demotion and sole admin deletion prevention
- Password reset tokens: SHA-256 hashed, rate limited per email+IP, constant-time responses to prevent enumeration

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

### Utility Modules

| Module | Purpose |
|--------|---------|
| `src/lib/api-utils.ts` | API response helpers (`handleApiError`, `validationError`, `notFoundError`) |
| `src/lib/prisma-selects.ts` | Shared select clauses, `transformTicket()` |
| `src/lib/sprint-utils.ts` | `generateNextSprintName()`, `isCompletedColumn()` |
| `src/lib/system-settings.ts` | Upload config, branding settings |
| `src/lib/permissions/` | RBAC with 14 permissions across 7 categories |
| `src/lib/email/` | Multi-provider email (SMTP, Resend, Console) |
| `src/lib/actions/` | Unified actions with optimistic updates and undo support |

### MCP Server

PUNT includes an MCP server for conversational ticket management. See `mcp/README.md` for full documentation.

**Key points:**
- Calls API endpoints (not direct Prisma) for real-time SSE updates
- Per-user API keys via **Profile > MCP API Key** in web UI
- 44 tools across tickets, projects, sprints, members, labels, columns, repository

**Querying conventions:**
- All tickets in scope by default (not just To Do/backlog)
- State which filters were used so user knows what was included/excluded
- When auditing tickets, query all columns and statuses

**Code conventions:**
- Use `??` (nullish coalescing), not `||` for values where `0`/`false`/`""` are valid
- Parallel subagents must use git worktrees (see `mcp/README.md`)

### Repository Integration

Per-project repository configuration for AI agent context. Configure in **Project Settings > Repository/Agents tabs**.

**Branch template variables:** `{type}`, `{key}`, `{number}`, `{slug}`, `{project}`

**MCP tools:** `get_repo_context`, `get_branch_name`

### Workflow Conventions

**Ticket filing vs. implementation:**

When a user asks to "file a ticket", "add a ticket", or "create a ticket", create the ticket and stop. Do not assume the user wants immediate implementation. Filing a ticket is a planning action, not a request to start work.

| User says | Action |
|-----------|--------|
| "File a ticket for X" / "Add a ticket for X" / "Create a ticket for X" | Create the ticket only. Do not implement. |
| "Work on PUNT-X" / "Implement PUNT-X" / "Tackle PUNT-X" | Implement the ticket. |
| "File a ticket and start working on it" / "Create PUNT-X and implement it" | Create the ticket, then implement. |

**When in doubt, ask.** If the user's intent is ambiguous, clarify before proceeding. User preferences expressed during the conversation override these defaults.

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

Railway config in `railway.toml`. Node.js >= 20.9.0 required (enforced in `package.json`). Requires PostgreSQL 16+.

**Prerequisites:** PostgreSQL 16+. Set `DATABASE_URL` in `.env` to your PostgreSQL connection string.

Demo mode env vars: `NEXT_PUBLIC_DEMO_MODE=true`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`

### Releasing

```bash
pnpm release patch   # 0.1.0 -> 0.1.1
pnpm release minor   # 0.1.0 -> 0.2.0
pnpm release major   # 0.1.0 -> 1.0.0
```

The script validates branch, updates `package.json`, commits, tags, and pushes. GitHub Actions then runs lint/tests, builds, and creates the release.
