'use client'

import { List, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
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

export default function BacklogPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const projectKey = projectKeys[projectId] || 'PROJ'

  const { getColumns, setColumns, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection } = useSelectionStore()

  // Get columns for this project
  const columns = getColumns(projectId)

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Initialize with demo data after hydration (only if columns are empty of tickets)
  useEffect(() => {
    if (!_hasHydrated) return // Wait for hydration

    const hasTickets = columns.some((col) => col.tickets.length > 0)
    if (!hasTickets) {
      const demoColumns = getDemoData(projectId)
      setColumns(projectId, demoColumns)
    }
    setActiveProjectId(projectId)
  }, [_hasHydrated, projectId, setActiveProjectId, setColumns, columns])

  // Extract all tickets from columns (flattened for backlog view)
  const allTickets = useMemo(() => {
    return columns.flatMap((col) => col.tickets)
  }, [columns])

  // Find the selected ticket
  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
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
