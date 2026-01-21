'use client'

import { List, Plus } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { SprintHeader } from '@/components/sprints'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useSprintCompletion } from '@/hooks/use-sprint-completion'
import { getDemoData } from '@/lib/demo-data'
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

  const { getColumns, setColumns, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection } = useSelectionStore()

  // Get columns for this project
  const columns = getColumns(projectId)

  // Demo project IDs that should get demo data
  const DEMO_PROJECT_IDS = ['1', '2', '3']
  const isDemoProject = DEMO_PROJECT_IDS.includes(projectId)

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Initialize with demo data after hydration (only for demo projects that have no tickets)
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
  }, [_hasHydrated, projectId, setActiveProjectId, setColumns, getColumns])

  // Extract all tickets from columns (flattened for backlog view)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Sprint header */}
      {!isDemoProject && (
        <div className="px-4 pt-4 lg:px-6">
          <SprintHeader projectId={projectId} tickets={allTickets} columns={columns} />
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
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

      {/* Backlog table */}
      <div className="flex-1 overflow-hidden">
        <BacklogTable
          tickets={allTickets}
          columns={columns}
          projectKey={projectKey}
          projectId={projectId}
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
