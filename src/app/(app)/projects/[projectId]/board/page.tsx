'use client'

import { Columns3, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { BacklogFilters } from '@/components/backlog'
import { KanbanBoard } from '@/components/board'
import { SprintHeader } from '@/components/sprints'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useActiveSprint } from '@/hooks/queries/use-sprints'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { useHasPermission } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { useTicketUrlSync } from '@/hooks/use-ticket-url-sync'
import { PERMISSIONS } from '@/lib/permissions'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
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
    setCreateTicketOpen,
    setActiveProjectId,
    activeTicketId,
    setActiveTicketId,
    openCreateTicketWithData,
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
    searchQuery,
  } = useBacklogStore()

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

  // Fetch active sprint - board only shows tickets in the active sprint
  const { data: activeSprint } = useActiveSprint(projectId)

  // Check permission to create tickets
  const canCreateTickets = useHasPermission(projectId, PERMISSIONS.TICKETS_CREATE)

  // Connect to real-time updates (after initial load)
  useRealtime(projectId, _hasHydrated && columnsLoaded && !ticketsLoading)

  // Get columns for this project
  const columns = getColumns(projectId)

  // URL ↔ drawer sync for shareable ticket links
  const { hasTicketParam } = useTicketUrlSync(projectId)

  // Clear selection and active ticket when entering this page
  // (unless URL has a ticket param that should open the drawer)
  useEffect(() => {
    clearSelection()
    if (!hasTicketParam()) {
      setActiveTicketId(null)
    }
  }, [clearSelection, setActiveTicketId, hasTicketParam])

  // Apply filters to columns
  // Board view only shows tickets in the active sprint
  const filteredColumns = useMemo((): ColumnWithTickets[] => {
    return columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((ticket) => {
        // BOARD ONLY: Filter to active sprint first
        // If there's an active sprint, only show tickets in that sprint
        // If there's no active sprint, show no tickets (board is sprint-focused)
        if (activeSprint) {
          if (ticket.sprintId !== activeSprint.id) return false
        } else {
          // No active sprint - board shows nothing
          return false
        }

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
    searchQuery,
    filterByType,
    filterByPriority,
    filterByStatus,
    filterByAssignee,
    filterByLabels,
    filterBySprint,
    filterByPoints,
    filterByDueDate,
  ])

  // Get all tickets for finding the selected one (use unfiltered for drawer)
  const allTickets = useMemo(() => columns.flatMap((col) => col.tickets), [columns])
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
    <div className="flex h-full flex-col">
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
                ? 'Drag and drop tickets to update their status'
                : 'Start a sprint to see tickets on the board'}
            </p>
          </div>
        </div>

        {/* Create ticket - auto-assign to active sprint */}
        {canCreateTickets && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (activeSprint) {
                openCreateTicketWithData({ sprintId: activeSprint.id })
              } else {
                setCreateTicketOpen(true)
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
        <SprintHeader projectId={projectId} tickets={allTickets} columns={columns} />

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <BacklogFilters statusColumns={columns} projectId={projectId} />
        </div>
      </div>

      {/* Board content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          <KanbanBoard
            projectKey={projectKey}
            projectId={projectId}
            filteredColumns={filteredColumns}
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
