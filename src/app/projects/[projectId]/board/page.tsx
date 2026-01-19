'use client'

import { AlertTriangle, Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { BacklogFilters } from '@/components/backlog'
import { KanbanBoard } from '@/components/board'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { getDemoData } from '@/lib/demo-data'
import { useBacklogStore } from '@/stores/backlog-store'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets } from '@/types'

export default function BoardPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { getProject, isLoading: projectsLoading } = useProjectsStore()
  const project = getProject(projectId)
  const projectKey = project?.key || 'PROJ'

  const { getColumns, setColumns, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
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

  // Get columns for this project
  const columns = getColumns(projectId)

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Apply filters to columns
  const filteredColumns = useMemo((): ColumnWithTickets[] => {
    return columns.map((col) => ({
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

        // Sprint filter
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

  // Demo project IDs that should get demo data
  const DEMO_PROJECT_IDS = ['1', '2', '3']

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Load demo data after hydration (only for demo projects that have no tickets)
  useEffect(() => {
    if (!_hasHydrated) return // Wait for hydration
    if (initializedProjectsRef.current.has(projectId)) {
      // Already initialized this project, just set active
      setActiveProjectId(projectId)
      return
    }

    // Only load demo data for the original demo projects, not user-created ones
    if (DEMO_PROJECT_IDS.includes(projectId)) {
      // Get columns fresh inside effect to avoid dependency issues
      const currentColumns = getColumns(projectId)
      const hasTickets = currentColumns.some((col) => col.tickets.length > 0)
      if (!hasTickets) {
        const demoColumns = getDemoData(projectId)
        setColumns(projectId, demoColumns)
      }
    }
    initializedProjectsRef.current.add(projectId)
    setActiveProjectId(projectId)
    // Note: getColumns is intentionally not in deps - we check fresh data inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, projectId, setActiveProjectId, setColumns])

  // Show not found if project doesn't exist after hydration
  if (!projectsLoading && !project) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-semibold text-zinc-100">Project not found</h1>
        <p className="text-zinc-500">The project you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/projects">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white">
            View all projects
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Board header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{projectKey} Board</h1>
            <p className="text-sm text-zinc-500">Drag and drop tickets to update their status</p>
          </div>

          {/* Create ticket */}
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white w-fit"
            onClick={() => setCreateTicketOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <BacklogFilters statusColumns={columns} />
        </div>
      </div>

      {/* Board content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          <KanbanBoard projectKey={projectKey} projectId={projectId} filteredColumns={filteredColumns} />
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
