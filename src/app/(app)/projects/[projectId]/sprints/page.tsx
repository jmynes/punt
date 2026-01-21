'use client'

import { Loader2, Target } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { SprintBacklogView } from '@/components/sprints'
import { TicketDetailDrawer } from '@/components/tickets'
import { useColumnsByProject, useTicketsByProject } from '@/hooks/queries/use-tickets'
import { getDemoData } from '@/lib/demo-data'
import { useBoardStore } from '@/stores/board-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'

// Demo project IDs that should get demo data instead of API
const DEMO_PROJECT_IDS = ['1', '2', '3']

export default function SprintPlanningPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { getProject, isLoading: projectsLoading } = useProjectsStore()
  const project = getProject(projectId)
  const projectKey = project?.key || 'PROJ'

  const { getColumns, setColumns, _hasHydrated } = useBoardStore()
  const { setActiveProjectId, activeTicketId, setActiveTicketId } = useUIStore()
  const { clearSelection } = useSelectionStore()

  // Determine if this is a demo project or a real project
  const isDemoProject = DEMO_PROJECT_IDS.includes(projectId)

  // Fetch columns from API for real projects
  const { isLoading: columnsLoading, isSuccess: columnsLoaded } = useColumnsByProject(projectId, {
    enabled: !isDemoProject && _hasHydrated,
  })

  // Fetch tickets from API for real projects (only after columns are loaded)
  const { isLoading: ticketsLoading } = useTicketsByProject(projectId, {
    enabled: !isDemoProject && _hasHydrated && columnsLoaded,
  })

  // Get columns for this project
  const columns = getColumns(projectId)

  // Clear selection when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Track which projects have been initialized to prevent re-running
  const initializedProjectsRef = useRef<Set<string>>(new Set())

  // Load demo data after hydration (only for demo projects that have no tickets)
  useEffect(() => {
    if (!_hasHydrated) return
    if (initializedProjectsRef.current.has(projectId)) {
      setActiveProjectId(projectId)
      return
    }

    if (isDemoProject) {
      const currentColumns = getColumns(projectId)
      const hasTickets = currentColumns.some((col) => col.tickets.length > 0)
      if (!hasTickets) {
        const demoColumns = getDemoData(projectId)
        setColumns(projectId, demoColumns)
      }
    }
    initializedProjectsRef.current.add(projectId)
    setActiveProjectId(projectId)
  }, [_hasHydrated, projectId, isDemoProject, setActiveProjectId, setColumns, getColumns])

  // Get all tickets from columns (flattened for sprint view)
  const allTickets = useMemo(() => columns.flatMap((col) => col.tickets), [columns])

  // Find the selected ticket
  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

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

  // Wait for store hydration
  if (!_hasHydrated) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-zinc-500">Loading sprint planning...</p>
      </div>
    )
  }

  // Show loading state for real projects
  if (!isDemoProject && (columnsLoading || ticketsLoading)) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-zinc-500">
          {columnsLoading ? 'Loading sprints...' : 'Loading tickets...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <Target className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{projectKey} Sprint Planning</h1>
            <p className="text-sm text-zinc-500">
              Plan your sprints and organize work across iterations
            </p>
          </div>
        </div>
      </div>

      {/* Sprint backlog view */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <SprintBacklogView projectId={projectId} projectKey={projectKey} tickets={allTickets} />
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
