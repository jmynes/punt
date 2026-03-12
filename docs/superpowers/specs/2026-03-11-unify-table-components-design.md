# Unify BacklogTable and SprintSection into Single Table Component

## Problem

The backlog page renders sprint sections using `SprintSection` and the backlog section using `BacklogTable` — two different components for the same purpose. This causes:

- Column misalignment when both are visible on the same page (different table elements with different auto-layout)
- Duplicated DnD coordination logic
- BacklogTable-specific code (681 lines) that largely duplicates what SprintSection already handles

The sprint planning page already uses `SprintSection` for both sprints AND backlog (`sprint=null`), proving the pattern works.

## Design

### Approach: Delete BacklogTable, use SprintSection everywhere

Replace `BacklogTable` on the backlog page with `SprintSection(sprint=null)`. Move the few unique BacklogTable behaviors to shared locations.

### What changes

**Delete:** `src/components/backlog/backlog-table.tsx`

**Modify:** `src/app/(app)/projects/[projectId]/backlog/page.tsx`
- Replace `BacklogTable` render with `SprintSection(sprint=null, collapsible=false)`
- The page already manages DnD, filtering, and drag state — just wire these to SprintSection's existing props (`draggingTicketIds`, `dropPosition`, callbacks)
- The page's unified DndContext remains (already handles cross-section moves)

**Modify:** `src/components/sprints/sprint-section.tsx`
- Already supports `sprint=null` for backlog display with issue count + points stats
- Verify `collapsible=false` mode works correctly for standalone backlog use
- Ensure the backlog stats display (issue count + points) matches what BacklogTable showed

**Extract:** Scroll preservation hook
- Move BacklogTable's scroll save/restore logic into a reusable hook (e.g., `useScrollPreservation`)
- Apply at the page level for both backlog and sprint views

### What stays the same

- `TicketListSection` — shared table plumbing (droppable zones, TableContext, sort, columns)
- `TicketTable` — actual table rendering
- Filtering, PQL, sort persistence — all at page level already
- Sprint header, progress bars, collapse — SprintSection-specific chrome

### Column alignment

With all sections using the same `SprintSection` → `TicketListSection` → `TicketTable` chain, every table on the page shares identical column definitions, widths, and layout. Alignment is automatic.

### Manual ordering

Both views already support drag reorder within sections. The sprint view handles it in `sprint-backlog-view.tsx` (lines 356-403) and the backlog page has its own handler. No changes needed — the page-level DnD handlers stay responsible for reorder logic.

## Files affected

| Action | File | Reason |
|--------|------|--------|
| Delete | `src/components/backlog/backlog-table.tsx` | Replaced by SprintSection |
| Modify | `src/app/(app)/projects/[projectId]/backlog/page.tsx` | Use SprintSection instead of BacklogTable |
| Modify | `src/components/sprints/sprint-section.tsx` | Minor: verify backlog mode parity |
| Create | `src/hooks/use-scroll-preservation.ts` | Extract from BacklogTable |
| Modify | `src/components/backlog/index.ts` | Remove BacklogTable export |

## Verification

1. Backlog page: filters, PQL, column config, sort, drag reorder within backlog, drag between sprint and backlog sections
2. Sprint planning page: unchanged behavior (already uses SprintSection for everything)
3. Column alignment: when sprint + backlog sections visible together, columns line up
4. Scroll preservation: scroll position maintained during reorder in both views
5. All existing tests pass
