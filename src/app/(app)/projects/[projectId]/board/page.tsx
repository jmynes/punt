'use client'

import { Columns3, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BacklogFilters } from '@/components/backlog'
import { KanbanBoard } from '@/components/board'
import { SprintHeader } from '@/components/sprints'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useProjectSprints } from '@/hooks/queries/use-sprints'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { useClickToDeselect } from '@/hooks/use-click-to-deselect'
import { useHasPermission } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { getProjectViewTabs, useTabCycleShortcut } from '@/hooks/use-tab-cycle-shortcut'
import { useTicketUrlSync } from '@/hooks/use-ticket-url-sync'
import { PERMISSIONS } from '@/lib/permissions'
import { evaluateQuery } from '@/lib/query-evaluator'
import { parse, QueryParseError } from '@/lib/query-parser'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets } from '@/types'

export default function BoardPage() {
  const params = useParams()
  const router = useRouter()
  const projectKey = params.projectId as string // URL now uses project key
  const { getProjectByKey, isLoading: projectsLoading } = useProjectsStore()
  const project = getProjectByKey(projectKey)
  const projectId = project?.id || projectKey // Use ID if found, fallback to key for API calls

  const { getColumns, _hasHydrated } = useBoardStore()
  const {
    setActiveProjectId,
    activeTicketId,
    setActiveTicketId,
    openCreateTicketWithData,
    setSprintCreateOpen,
  } = useUIStore()
  const { clearSelection } = useSelectionStore()
  const {
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
    filterByResolution,
    searchQuery,
    queryMode,
    queryText,
    setSearchQuery,
    setQueryText,
    setQueryMode,
  } = useBacklogStore()

  // Click-to-deselect on empty space (covers page header, filter bar, and content)
  const handleDeselect = useClickToDeselect()

  // Tab cycling keyboard shortcut (Ctrl+Shift+Arrow)
  useTabCycleShortcut({ tabs: getProjectViewTabs(projectKey) })

  // Fetch columns from API (creates defaults if none exist)
  const {
    isLoading: columnsLoading,
    error: columnsError,
    isSuccess: columnsLoaded,
  } = useColumnsByProject(projectId, {
    enabled: _hasHydrated,
  })

  // Fetch tickets from API (only after columns are loaded)
  const { isLoading: ticketsLoading, error: ticketsError } = useTicketsByProject(projectId, {
    enabled: _hasHydrated && columnsLoaded,
  })

  // Fetch all sprints - board shows active sprint, or planning sprint if no active
  const { data: sprints } = useProjectSprints(projectId)

  // Determine which sprint to show on the board (active > planning)
  const activeSprint = useMemo(() => {
    if (!sprints) return null
    // Prefer active sprint
    const active = sprints.find((s) => s.status === 'active')
    if (active) return active
    // Fall back to first planning sprint
    const planning = sprints.find((s) => s.status === 'planning')
    return planning || null
  }, [sprints])

  // Debounce query text to prevent per-keystroke evaluation
  const [debouncedQueryText, setDebouncedQueryText] = useState(queryText)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQueryText(queryText), 150)
    return () => clearTimeout(timer)
  }, [queryText])

  // Check permission to create tickets
  const canCreateTickets = useHasPermission(projectId, PERMISSIONS.TICKETS_CREATE)

  // Connect to real-time updates (after initial load)
  useRealtime(projectId, _hasHydrated && columnsLoaded && !ticketsLoading)

  // Get columns for this project
  const columns = getColumns(projectId)

  // Get all tickets for dynamic values extraction
  const allTicketsRaw = useMemo(() => columns.flatMap((col) => col.tickets), [columns])

  // Extract dynamic values for query autocomplete
  const dynamicValues = useMemo(() => {
    const statusNames = columns.map((c) => c.name)
    const userSet = new Set<string>()
    const labelSet = new Set<string>()

    for (const ticket of allTicketsRaw) {
      if (ticket.assignee?.name) userSet.add(ticket.assignee.name)
      if (ticket.creator?.name) userSet.add(ticket.creator.name)
      for (const label of ticket.labels) {
        labelSet.add(label.name)
      }
    }

    const sprintNames = sprints?.map((s) => s.name).sort() ?? []

    return {
      statusNames,
      assigneeNames: Array.from(userSet).sort(),
      sprintNames,
      labelNames: Array.from(labelSet).sort(),
    }
  }, [allTicketsRaw, columns, sprints])

  // Compute query error
  const queryError = useMemo(() => {
    if (!queryMode || !debouncedQueryText.trim()) return null
    try {
      parse(debouncedQueryText)
      return null
    } catch (err) {
      return err instanceof QueryParseError ? err.message : 'Invalid query'
    }
  }, [queryMode, debouncedQueryText])

  // URL ↔ drawer sync for shareable ticket links
  const { hasTicketParam } = useTicketUrlSync(projectKey)

  // Clear selection and active ticket when entering this page
  // (unless URL has a ticket param that should open the drawer)
  useEffect(() => {
    clearSelection()
    if (!hasTicketParam()) {
      setActiveTicketId(null)
    }
  }, [clearSelection, setActiveTicketId, hasTicketParam])

  // Clear search state based on searchPersistence preference
  const searchPersistence = useSettingsStore((s) => s.searchPersistence)
  useEffect(() => {
    const { searchProjectId } = useBacklogStore.getState()
    const projectChanged = searchProjectId !== null && searchProjectId !== projectId

    if (searchPersistence === 'never') {
      setSearchQuery('')
      setQueryText('')
      setQueryMode(false)
    } else if (searchPersistence === 'within-project' && projectChanged) {
      setSearchQuery('')
      setQueryText('')
      setQueryMode(false)
    }
    // 'always': never clear

    useBacklogStore.getState().setSearchProjectId(projectId)
  }, [projectId, searchPersistence, setSearchQuery, setQueryText, setQueryMode])

  // Apply filters to columns
  // Board view shows tickets in the current sprint (active or planning)
  const filteredColumns = useMemo((): ColumnWithTickets[] => {
    // First, filter tickets to the active sprint (board requirement)
    const sprintFilteredColumns = columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((ticket) => {
        // BOARD ONLY: Filter to current sprint (active or planning)
        if (activeSprint) {
          return ticket.sprintId === activeSprint.id
        }
        // No sprint - board shows nothing
        return false
      }),
    }))

    // If PQL mode is active, use the query evaluator
    if (queryMode && debouncedQueryText.trim()) {
      try {
        const ast = parse(debouncedQueryText)
        // Flatten, evaluate, then redistribute to columns
        const allSprintTickets = sprintFilteredColumns.flatMap((col) => col.tickets)
        const matchedTickets = evaluateQuery(ast, allSprintTickets, columns, projectKey)
        const matchedIds = new Set(matchedTickets.map((t) => t.id))

        return sprintFilteredColumns.map((col) => ({
          ...col,
          tickets: col.tickets.filter((t) => matchedIds.has(t.id)),
        }))
      } catch {
        // Invalid query - show all sprint tickets
        return sprintFilteredColumns
      }
    }

    // Standard filter mode
    return sprintFilteredColumns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((ticket) => {
        // Search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const matchesSearch =
            ticket.title.toLowerCase().includes(query) ||
            ticket.description?.toLowerCase().includes(query) ||
            `${ticket.number}`.includes(query)
          if (!matchesSearch) return false
        }

        // Type filter
        if (filterByType.length > 0 && !filterByType.includes(ticket.type)) return false

        // Priority filter
        if (filterByPriority.length > 0 && !filterByPriority.includes(ticket.priority)) return false

        // Status filter
        if (filterByStatus.length > 0 && !filterByStatus.includes(ticket.columnId)) return false

        // Resolution filter
        if (filterByResolution.length > 0) {
          if (filterByResolution.includes('unresolved')) {
            if (!ticket.resolution) return true
          }
          if (!ticket.resolution || !filterByResolution.includes(ticket.resolution)) return false
        }

        // Assignee filter
        if (filterByAssignee.length > 0) {
          const ticketAssigneeId = ticket.assigneeId || 'unassigned'
          if (!filterByAssignee.includes(ticketAssigneeId)) return false
        }

        // Labels filter
        if (filterByLabels.length > 0) {
          const ticketLabelIds = ticket.labels.map((l) => l.id)
          if (!filterByLabels.some((labelId) => ticketLabelIds.includes(labelId))) return false
        }

        // Sprint filter (additional filtering within the active sprint, e.g., user manually overrides)
        if (filterBySprint) {
          if (filterBySprint === 'backlog') {
            if (ticket.sprintId) return false
          } else if (ticket.sprintId !== filterBySprint) {
            return false
          }
        }

        // Story points filter
        if (filterByPoints) {
          const points = ticket.storyPoints ?? 0
          const { operator, value } = filterByPoints
          switch (operator) {
            case '<':
              if (!(points < value)) return false
              break
            case '>':
              if (!(points > value)) return false
              break
            case '=':
              if (!(points === value)) return false
              break
            case '<=':
              if (!(points <= value)) return false
              break
            case '>=':
              if (!(points >= value)) return false
              break
          }
        }

        // Due date filter
        if (filterByDueDate.includeNone) {
          if (ticket.dueDate) return false
        } else if (filterByDueDate.includeOverdue) {
          if (!ticket.dueDate || ticket.dueDate >= new Date()) return false
        } else if (filterByDueDate.from || filterByDueDate.to) {
          if (!ticket.dueDate) return false
          if (filterByDueDate.from && ticket.dueDate < filterByDueDate.from) return false
          if (filterByDueDate.to && ticket.dueDate > filterByDueDate.to) return false
        }

        return true
      }),
    }))
  }, [
    columns,
    activeSprint,
    queryMode,
    debouncedQueryText,
    projectKey,
    searchQuery,
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByResolution,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
  ])

  // Use allTicketsRaw for finding the selected ticket (use unfiltered for drawer)
  const allTickets = allTicketsRaw

  // Flattened filtered tickets for sprint progress overlay
  const filteredTicketsFlat = useMemo(
    () => filteredColumns.flatMap((col) => col.tickets),
    [filteredColumns],
  )

  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

  // Sprint completion detection (handles expired sprint prompts)
  useSprintCompletion({
    projectId,
    tickets: allTickets,
    columns,
  })

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Set active project after hydration
  useEffect(() => {
    if (!_hasHydrated) return
    if (initializedProjectsRef.current.has(projectId)) {
      setActiveProjectId(projectId)
      return
    }
    initializedProjectsRef.current.add(projectId)
    setActiveProjectId(projectId)
  }, [_hasHydrated, projectId, setActiveProjectId])

  // Redirect to dashboard if project doesn't exist after hydration
  useEffect(() => {
    if (!projectsLoading && !project) {
      router.replace('/')
    }
  }, [projectsLoading, project, router])

  // Show nothing while redirecting
  if (!projectsLoading && !project) {
    return null
  }

  // Wait for store hydration to prevent hydration mismatch
  // Server renders with empty store, client may have localStorage data
  if (!_hasHydrated) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="mt-4 text-sm text-zinc-500">Loading board...</p>
      </div>
    )
  }

  // Show loading state while fetching columns/tickets
  if (columnsLoading || ticketsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="mt-4 text-sm text-zinc-500">
          {columnsLoading ? 'Loading board...' : 'Loading tickets...'}
        </p>
      </div>
    )
  }

  // Show error state if columns or ticket fetch failed
  if (columnsError || ticketsError) {
    const error = columnsError || ticketsError
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-sm text-red-400">Failed to load board</p>
        <p className="mt-2 text-xs text-zinc-500">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" onClick={handleDeselect}>
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800">
            <Columns3 className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              {project?.key || projectKey} Board
            </h1>
            <p className="text-sm text-zinc-500">
              {activeSprint
                ? `Drag and drop tickets to update their status${activeSprint.status === 'planning' ? ' (planning sprint)' : ''}`
                : 'Create a sprint to see tickets on the board'}
            </p>
          </div>
        </div>

        {/* Create ticket - auto-assign to active sprint and To Do column */}
        {canCreateTickets && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (activeSprint) {
                // Find the "To Do" column (or first column as fallback)
                const todoColumn = columns.find((c) => c.name === 'To Do') || columns[0]
                openCreateTicketWithData({
                  sprintId: activeSprint.id,
                  columnId: todoColumn?.id,
                })
              } else {
                // No active sprint - prompt to create one first
                setSprintCreateOpen(true)
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        )}
      </div>

      {/* Sprint header + filters */}
      <div className="flex-shrink-0 flex flex-col gap-4 px-4 py-4 lg:px-6 border-b border-zinc-800">
        {/* Sprint progress */}
        <SprintHeader
          projectId={projectId}
          tickets={allTickets}
          columns={columns}
          filteredTickets={filteredTicketsFlat}
        />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <BacklogFilters
            statusColumns={columns}
            projectId={projectId}
            dynamicValues={dynamicValues}
            queryError={queryError}
          />
        </div>
      </div>

      {/* Board content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          <KanbanBoard
            projectKey={projectKey}
            projectId={projectId}
            filteredColumns={filteredColumns}
            activeSprintId={activeSprint?.id}
          />
        </div>
      </div>

      {/* Ticket detail drawer */}
      <TicketDetailDrawer
        ticket={selectedTicket}
        projectKey={projectKey}
        onClose={() => setActiveTicketId(null)}
      />
    </div>
  )
}
