'use client'

import { List, Loader2, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { ColumnConfig } from '@/components/backlog'
import { SprintSection } from '@/components/sprints'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useActiveSprint } from '@/hooks/queries/use-sprints'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'

export default function BacklogPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { getProject, isLoading: projectsLoading } = useProjectsStore()
  const project = getProject(projectId)
  const projectKey = project?.key || 'PROJ'

  const { getColumns, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection } = useSelectionStore()

  // Fetch columns from API
  const { isLoading: columnsLoading, isSuccess: columnsLoaded } = useColumnsByProject(projectId, {
    enabled: _hasHydrated,
  })

  // Fetch tickets from API (only after columns are loaded)
  const { isLoading: ticketsLoading } = useTicketsByProject(projectId, {
    enabled: _hasHydrated && columnsLoaded,
  })

  // Fetch active sprint
  const { data: activeSprint } = useActiveSprint(projectId)

  // Get columns for this project
  const columns = getColumns(projectId)

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

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

  // Extract all tickets from columns (flattened for backlog view)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Split tickets into sprint vs backlog
  const sprintTickets = useMemo(() => {
    if (!activeSprint) return []
    return allTickets.filter((t) => t.sprintId === activeSprint.id)
  }, [allTickets, activeSprint])

  const backlogTickets = useMemo(() => {
    return allTickets.filter((t) => !t.sprintId)
  }, [allTickets])

  // Find the selected ticket
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

  // Redirect to dashboard if project doesn't exist after loading
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
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-zinc-500">Loading backlog...</div>
      </div>
    )
  }

  // Show loading state
  if (columnsLoading || ticketsLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-zinc-500">
          {columnsLoading ? 'Loading columns...' : 'Loading tickets...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Page header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800">
            <List className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{projectKey} Backlog</h1>
            <p className="text-sm text-zinc-500">
              View and manage all tickets in a configurable list
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => setCreateTicketOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Scrollable content with sprint and backlog sections */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 lg:p-6 space-y-4">
        {/* Active Sprint Section - Jira-style collapsible section */}
        {activeSprint && (
          <SprintSection
            sprint={activeSprint}
            tickets={sprintTickets}
            projectKey={projectKey}
            projectId={projectId}
            defaultExpanded={true}
          />
        )}

        {/* Backlog Section */}
        <SprintSection
          sprint={null}
          tickets={backlogTickets}
          projectKey={projectKey}
          projectId={projectId}
          defaultExpanded={true}
        />
      </div>

      {/* Column config sheet */}
      <ColumnConfig />

      {/* Ticket detail drawer */}
      <TicketDetailDrawer
        ticket={selectedTicket}
        projectKey={projectKey}
        onClose={() => setActiveTicketId(null)}
      />
    </div>
  )
}
