# Unify Table Components Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `BacklogTable` with `SprintSection(sprint=null)` on the backlog page so there's one table component everywhere, then delete `BacklogTable`.

**Architecture:** The backlog page currently renders sprint sections using `SprintSection` and the backlog using a separate `BacklogTable` component. Since `SprintSection` already supports `sprint=null` for backlog display, we replace `BacklogTable` with `SprintSection` on the backlog page. The unique BacklogTable features (filtering, summary stats toolbar, column config button, scroll preservation, manual ordering) either already exist at the page level or move there.

**Tech Stack:** React, Next.js, dnd-kit, Zustand, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Delete | `src/components/backlog/backlog-table.tsx` | Replaced entirely |
| Delete | `src/components/backlog/__tests__/backlog-table.test.tsx` | Tests for deleted component |
| Modify | `src/components/backlog/index.ts` | Remove BacklogTable export |
| Modify | `src/app/(app)/projects/[projectId]/backlog/page.tsx` | Replace BacklogTable with SprintSection; move filtering, toolbar, summary stats inline |
| Modify | `src/components/sprints/sprint-section.tsx` | Add `showHeader` prop to optionally hide the sprint/backlog header chrome |
| Update | `src/components/table/*.tsx` | Update comments referencing BacklogTable |

---

### Task 1: Add `showHeader` prop to SprintSection

SprintSection currently always renders its header (sprint name, stats, action buttons). On the backlog page, the page itself renders the toolbar and summary stats, so we need a way to suppress the SprintSection header. The backlog page already passes `collapsible=false` but the header still renders.

**Files:**
- Modify: `src/components/sprints/sprint-section.tsx`

- [ ] **Step 1: Add `showHeader` prop**

In `SprintSectionProps` interface, add:
```typescript
/** Whether to show the section header (default: true). When false, only the table is rendered. */
showHeader?: boolean
```

In the component, destructure `showHeader = true` and wrap the header JSX:
```typescript
{showHeader && (
  <div onClick={...} className={...}>
    {/* existing header content */}
  </div>
)}
```

- [ ] **Step 2: Verify sprint planning page still works**

Run: `pnpm dev` and check `/projects/PUNT/sprints` — all sprint sections should show headers as before (default `showHeader=true`).

- [ ] **Step 3: Commit**

```bash
git add src/components/sprints/sprint-section.tsx
git commit -m "feat(sprints): add showHeader prop to SprintSection"
```

---

### Task 2: Move BacklogTable's toolbar and summary stats into backlog page

The backlog page needs to render the filter toolbar and summary stats that were previously inside BacklogTable. These move into the page itself, between the page header and the table content.

**Files:**
- Modify: `src/app/(app)/projects/[projectId]/backlog/page.tsx`

**What moves from BacklogTable to the page:**
1. Filter toolbar (`BacklogFilters` + Columns button) — lines 511-530 of backlog-table.tsx
2. Summary header (ticket count + story points) — lines 532-604 of backlog-table.tsx
3. Filtering logic (PQL + standard filters) — lines 88-315 of backlog-table.tsx
4. Sort persistence reset — lines 123-132 of backlog-table.tsx
5. Manual backlog ordering (`backlogOrder`, `applyBacklogOrder`) — lines 134-223 of backlog-table.tsx

The backlog page already has some of this for the sprint sections (e.g., `ticketsBySprint`). The key addition is applying filters and backlog ordering to `ticketsBySprint.backlog` before passing to SprintSection.

- [ ] **Step 1: Add filtering imports and state**

Add to the backlog page imports:
```typescript
import { BacklogFilters } from '@/components/backlog'
import { Settings2, TrendingUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { filterTickets } from '@/lib/filter-tickets'
import { evaluateQuery } from '@/lib/query-evaluator'
import { parse, QueryParseError } from '@/lib/query-parser'
import { sortTickets } from '@/lib/ticket-sort'
```

Add backlog store destructuring for filter state (the page already imports `useBacklogStore` for `backlogOrder`, `setBacklogOrder`, `reorderColumns`, `backlogColumns`). Add:
```typescript
const {
  // existing...
  columns: backlogColumns,
  setBacklogOrder,
  reorderColumns,
  backlogOrder,
  setSearchQuery,
  setQueryText,
  setQueryMode,
  // new filter state:
  sort,
  setSort,
  toggleSort,
  toggleColumnVisibility,
  setColumnConfigOpen,
  filterByType,
  filterByPriority,
  filterByStatus,
  filterByResolution,
  filterByAssignee,
  filterByLabels,
  filterBySprint,
  filterByPoints,
  filterByDueDate,
  filterByAttachments,
  searchQuery,
  showSubtasks,
  queryMode,
  queryText,
} = useBacklogStore()
```

- [ ] **Step 2: Add filtering, sorting, and ordering logic**

Add after `ticketsBySprint` memo:

```typescript
// Sort persistence reset
const persistTableSort = useSettingsStore((s) => s.persistTableSort)
const sortResetRef2 = useRef(false)
useEffect(() => {
  if (!sortResetRef2.current) {
    sortResetRef2.current = true
    if (!persistTableSort) {
      setSort({ column: 'key', direction: 'desc' })
    }
  }
}, [persistTableSort, setSort])

// Debounce query text
const [debouncedQueryText, setDebouncedQueryText] = useState(queryText)
useEffect(() => {
  const timer = setTimeout(() => setDebouncedQueryText(queryText), 150)
  return () => clearTimeout(timer)
}, [queryText])

// Query error for display
const queryError = useMemo(() => {
  if (!queryMode || !debouncedQueryText.trim()) return null
  try {
    parse(debouncedQueryText)
    return null
  } catch (err) {
    return err instanceof QueryParseError ? err.message : 'Invalid query'
  }
}, [queryMode, debouncedQueryText])

// Dynamic values for autocomplete
const dynamicValues = useMemo(() => {
  const statusNames = columns.map((c) => c.name)
  const userSet = new Set<string>()
  const labelSet = new Set<string>()
  for (const ticket of allTickets) {
    if (ticket.assignee?.name) userSet.add(ticket.assignee.name)
    if (ticket.creator?.name) userSet.add(ticket.creator.name)
    for (const label of ticket.labels) labelSet.add(label.name)
  }
  const sprintNames = sprints?.map((s) => s.name).sort() ?? []
  return {
    statusNames,
    assigneeNames: Array.from(userSet).sort(),
    sprintNames,
    labelNames: Array.from(labelSet).sort(),
  }
}, [allTickets, columns, sprints])

// Apply backlog order
const applyBacklogOrder = useCallback(
  (ticketList: TicketWithRelations[], order: string[]) => {
    if (order.length === 0) return ticketList
    const orderSet = new Set(order)
    const ordered = order
      .map((id) => ticketList.find((t) => t.id === id))
      .filter(Boolean) as TicketWithRelations[]
    const remaining = ticketList.filter((t) => !orderSet.has(t.id))
    return [...ordered, ...remaining]
  },
  [],
)

// Filter and sort backlog tickets
const filteredBacklogTickets = useMemo(() => {
  const rawBacklog = ticketsBySprint.backlog ?? []
  const projectOrder = backlogOrder[projectId] || []
  const orderedBacklog = applyBacklogOrder(rawBacklog, projectOrder)

  let result: TicketWithRelations[]
  if (queryMode && debouncedQueryText.trim()) {
    try {
      const ast = parse(debouncedQueryText)
      result = evaluateQuery(ast, orderedBacklog, columns, projectKey)
      if (!showSubtasks) result = result.filter((t) => t.type !== 'subtask')
    } catch {
      result = [...orderedBacklog]
      if (!showSubtasks) result = result.filter((t) => t.type !== 'subtask')
    }
  } else {
    result = filterTickets(orderedBacklog, {
      searchQuery, projectKey, filterByType, filterByPriority,
      filterByStatus, filterByResolution, filterByAssignee,
      filterByLabels, filterBySprint, filterByPoints,
      filterByDueDate, filterByAttachments, showSubtasks,
    })
  }

  if (sort) {
    result = sortTickets(result, sort, columns)
  }

  return result
}, [
  ticketsBySprint, backlogOrder, projectId, applyBacklogOrder,
  queryMode, debouncedQueryText, columns, projectKey,
  searchQuery, filterByType, filterByPriority, filterByStatus,
  filterByResolution, filterByAssignee, filterByLabels,
  filterBySprint, filterByPoints, filterByDueDate,
  filterByAttachments, showSubtasks, sort,
])

// Summary stats
const backlogTickets = ticketsBySprint.backlog ?? []
const filteredPoints = filteredBacklogTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
const totalBacklogPoints = backlogTickets.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
const isBacklogFiltered = filteredBacklogTickets.length !== backlogTickets.length
```

- [ ] **Step 3: Replace BacklogTable render with toolbar + SprintSection**

Replace lines 1037-1048 (the `BacklogTable` render) with:

```tsx
{/* Backlog section with filters */}
<div className="flex-1 overflow-hidden min-h-0 flex flex-col">
  {/* Filter toolbar */}
  <div className="flex flex-col border-b border-zinc-800">
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <BacklogFilters
        projectId={projectId}
        statusColumns={columns}
        dynamicValues={dynamicValues}
        queryError={queryError}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setColumnConfigOpen(true)}
        className="shrink-0"
      >
        <Settings2 className="mr-2 h-4 w-4" />
        Columns
      </Button>
    </div>
  </div>

  {/* Summary header */}
  <div className="flex shrink-0 items-center justify-end gap-4 border-b border-zinc-800 px-4 py-2 text-sm">
    {/* Ticket count */}
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default text-zinc-400">
          {isBacklogFiltered ? (
            <>
              <span className="font-medium tabular-nums text-zinc-200">
                {filteredBacklogTickets.length}
              </span>
              <span className="text-zinc-600"> / </span>
              <span className="tabular-nums text-zinc-500">{backlogTickets.length}</span>{' '}
              {backlogTickets.length === 1 ? 'issue' : 'issues'}
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums text-zinc-200">{backlogTickets.length}</span>{' '}
              <span className="text-zinc-500">{backlogTickets.length === 1 ? 'issue' : 'issues'}</span>
            </>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
        {isBacklogFiltered ? (
          <div className="space-y-1">
            <p className="text-xs text-zinc-100">
              Showing {filteredBacklogTickets.length} of {backlogTickets.length} issues
            </p>
            <p className="text-xs text-zinc-400">Filters are active</p>
          </div>
        ) : (
          <p className="text-xs text-zinc-100">
            {backlogTickets.length} {backlogTickets.length === 1 ? 'issue' : 'issues'} in backlog
          </p>
        )}
      </TooltipContent>
    </Tooltip>

    {/* Story points */}
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center gap-1.5 text-zinc-400">
          <TrendingUp className="h-3.5 w-3.5" />
          {isBacklogFiltered ? (
            <>
              <span className="font-medium tabular-nums text-zinc-200">{filteredPoints}</span>
              <span className="text-zinc-600"> / </span>
              <span className="tabular-nums text-zinc-500">{totalBacklogPoints}</span>
              <span className="text-zinc-600"> pts</span>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums text-zinc-200">{totalBacklogPoints}</span>
              <span className="text-zinc-500"> pts</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700">
        {isBacklogFiltered ? (
          <div className="space-y-1">
            <p className="text-xs text-zinc-100">
              Showing {filteredPoints} of {totalBacklogPoints} story points
            </p>
            <p className="text-xs text-zinc-400">Filters are active</p>
          </div>
        ) : (
          <p className="text-xs text-zinc-100">{totalBacklogPoints} story points in backlog</p>
        )}
      </TooltipContent>
    </Tooltip>
  </div>

  {/* Backlog table via SprintSection */}
  <div className="flex-1 overflow-y-auto min-h-0">
    <SprintSection
      sprint={null}
      tickets={filteredBacklogTickets}
      projectKey={projectKey}
      projectId={projectId}
      statusColumns={columns}
      collapsible={false}
      showHeader={false}
      draggingTicketIds={draggingTicketIds}
      dropPosition={dropPosition?.sectionId === 'backlog' ? dropPosition.insertIndex : null}
    />
  </div>
</div>
```

- [ ] **Step 4: Remove BacklogTable import**

Remove `BacklogTable` from the import on line 21:
```typescript
// Before:
import { BacklogTable, ColumnConfig, FilterConfig } from '@/components/backlog'
// After:
import { BacklogFilters, ColumnConfig, FilterConfig } from '@/components/backlog'
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm dev` — check for TypeScript errors in the terminal.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/projects/\[projectId\]/backlog/page.tsx
git commit -m "refactor(backlog): replace BacklogTable with SprintSection on backlog page"
```

---

### Task 3: Delete BacklogTable and clean up references

**Files:**
- Delete: `src/components/backlog/backlog-table.tsx`
- Delete: `src/components/backlog/__tests__/backlog-table.test.tsx`
- Modify: `src/components/backlog/index.ts`
- Modify: `src/components/table/ticket-list-section.tsx` (comment update)
- Modify: `src/components/table/ticket-table.tsx` (comment update)
- Modify: `src/components/table/ticket-table-row.tsx` (comment update)
- Modify: `src/components/table/types.ts` (comment update)

- [ ] **Step 1: Delete BacklogTable files**

```bash
rm src/components/backlog/backlog-table.tsx
rm src/components/backlog/__tests__/backlog-table.test.tsx
```

- [ ] **Step 2: Remove export from index.ts**

In `src/components/backlog/index.ts`, remove:
```typescript
export { BacklogTable } from './backlog-table'
```

- [ ] **Step 3: Update comments referencing BacklogTable**

In `src/components/table/ticket-list-section.tsx`, `ticket-table.tsx`, `ticket-table-row.tsx`, and `types.ts`, update comments like "Used by both BacklogTable and SprintSection" to "Used by SprintSection and backlog page" or just remove the component-specific references.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

All tests should pass. The deleted `backlog-table.test.tsx` was testing BacklogTable directly — those tests are no longer needed since the component is gone. The backlog page's behavior is covered by the page-level integration.

- [ ] **Step 5: Verify both pages work**

- `/projects/PUNT/backlog` — filters, PQL, column config, sort, drag reorder, drag between sprint and backlog, summary stats
- `/projects/PUNT/sprints` — unchanged behavior
- Column alignment: when sprint + backlog sections visible together on backlog page, columns should align

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(backlog): delete BacklogTable, use SprintSection everywhere (PUNT-122)"
```

---

### Task 4: Lint, test, and finalize

- [ ] **Step 1: Run linter**

```bash
pnpm lint
```

Fix any issues.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

All tests must pass.

- [ ] **Step 3: Final manual verification**

Test these scenarios:
1. Backlog page: all filter types work, PQL works, column show/hide/reorder, sort by headers, summary stats show correct counts
2. Backlog page: drag reorder within backlog section, drag between sprint and backlog sections
3. Sprint planning page: unchanged behavior — all sections work, drag between sections
4. Column alignment: on backlog page with sprint sections visible, columns line up between sprint and backlog tables
5. Scroll doesn't jump during reorder operations

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix(backlog): address review feedback from table unification"
```
