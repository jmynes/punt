# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PUNT (Project Unified Nimble Tracker) is a local-first ticketing system with Jira-like backlog + Kanban board. Built with Next.js 16 (App Router), React 19, TypeScript, SQLite/Prisma, and Zustand for state management.

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

### State Management (Zustand)

All client-side state lives in Zustand stores with localStorage persistence:

- **board-store**: Kanban columns/tickets per project. Key pattern: `projects: Record<projectId, ColumnWithTickets[]>`. Use `getColumns(projectId)` to access. Custom date revival on hydration.
- **backlog-store**: Backlog view config (15 columns, multi-filter support, sorting). Filters by type/priority/status/assignee/labels/sprint/story-points/due-date.
- **undo-store**: Undo/redo stack for all reversible actions (delete, move, paste, update, ticketCreate, projectCreate/Delete). Each action has `toastId` for UI feedback.
- **selection-store**: Multi-select with `selectedTicketIds: Set<string>`, clipboard via `copiedTicketIds`, and `ticketOrigins` map for arrow key navigation.
- **projects-store**: Project list with sequential numeric ID generation.
- **ui-store**: Modal/drawer/sidebar visibility states and `prefillTicketData` for form pre-population.

Stores use `_hasHydrated` flag to prevent render before localStorage loads.

### Database (Prisma + SQLite)

Schema in `prisma/schema.prisma`. Key models:
- **Ticket**: 25+ fields including type/priority/order/storyPoints. Unique constraint on `[projectId, number]` for ticket keys (e.g., PUNT-1).
- **Column**: Board columns with order field.
- **Project**: Has key (unique), color, and relations to columns/tickets/members/labels/sprints.

Types generated to `@/generated/prisma/client`, re-exported with relations from `@/types/index.ts`.

### Component Patterns

- **Board**: `KanbanBoard` orchestrates dnd-kit with `KanbanColumn` and `KanbanCard`. Multi-select drag shows overlay; dragged tickets hidden from columns during drag.
- **Backlog**: `BacklogTable` with configurable columns, sorting headers, filtering dropdowns.
- **UI**: shadcn/ui components in `src/components/ui/`.

### Key Patterns

- **Optimistic updates**: Store updates happen immediately; before-drag snapshots saved for undo.
- **Multi-select**: Click=single, Shift+Click=range, Ctrl/Cmd+Click=toggle. `lastSelectedId` tracks range anchor.
- **Undo/Redo**: Action-centric with project-scoped entries. Toast buttons trigger undo, support undo→redo→undo chains.
- **Arrow key navigation**: Selected tickets track origin column/position for cross-column movement.

### File Organization

```
src/
├── app/                    # Next.js pages + API routes
│   ├── projects/[projectId]/{board,backlog}/
│   └── api/upload/         # File upload endpoint (only API route)
├── components/
│   ├── board/              # Kanban (dnd-kit integration)
│   ├── backlog/            # Table view
│   ├── tickets/            # Cards, forms, modals
│   └── ui/                 # shadcn/ui
├── stores/                 # Zustand stores
├── hooks/                  # useCurrentUser (hardcoded demo), useMediaQuery
├── lib/                    # db.ts, logger.ts, file-storage.ts, undo-toast.ts
└── types/                  # Prisma re-exports + custom types
```

### Testing

Vitest + React Testing Library. Tests colocated in `__tests__/` subdirectories. Use custom render from `@/__tests__/utils/test-utils`. Reset store state in `beforeEach`. Coverage target: 80% minimum, 90% for stores/API/utils.

### Debugging

- Logger: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.measure()`
- Enable via `NEXT_PUBLIC_DEBUG=true`
- Window globals in dev: `window.boardStore`, `window.undoStore`
