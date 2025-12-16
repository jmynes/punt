'use client'

import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { KanbanBoard } from '@/components/board'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDemoData } from '@/lib/demo-data'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'

// Project key lookup
const projectKeys: Record<string, string> = {
  '1': 'PUNT',
  '2': 'API',
  '3': 'MOB',
}

export default function BoardPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const projectKey = projectKeys[projectId] || 'PROJ'

  const { getColumns, setColumns, getSearchQuery, setSearchQuery, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection } = useSelectionStore()

  // Get columns for this project
  const columns = getColumns(projectId)
  const searchQuery = getSearchQuery(projectId)

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Get all tickets for finding the selected one
  const allTickets = useMemo(() => columns.flatMap((col) => col.tickets), [columns])
  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

  // Load demo data after hydration (only if columns are empty of tickets)
  useEffect(() => {
    if (!_hasHydrated) return // Wait for hydration

    const hasTickets = columns.some((col) => col.tickets.length > 0)
    if (!hasTickets) {
      const demoColumns = getDemoData(projectId)
      setColumns(projectId, demoColumns)
    }
    setActiveProjectId(projectId)
  }, [_hasHydrated, projectId, setActiveProjectId, setColumns, columns])

  // Clear search when leaving page
  useEffect(() => {
    return () => setSearchQuery(projectId, '')
  }, [projectId, setSearchQuery])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Board header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{projectKey} Board</h1>
          <p className="text-sm text-zinc-500">Drag and drop tickets to update their status</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative lg:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder="Filter tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(projectId, e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter buttons */}
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-amber-500/15 hover:border-zinc-600"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-amber-500/15 hover:border-zinc-600"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            View
          </Button>

          {/* Create ticket */}
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => setCreateTicketOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Ticket</span>
          </Button>
        </div>
      </div>

      {/* Board content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          <KanbanBoard projectKey={projectKey} projectId={projectId} />
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
