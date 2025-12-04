'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets } from '@/types'
import { KanbanCard } from './kanban-card'

interface KanbanColumnProps {
  column: ColumnWithTickets
  projectKey: string
  dragSelectionIds?: string[]
  activeTicketId?: string | null
  activeDragTarget?: number | null
}

export function KanbanColumn({
  column,
  projectKey,
  dragSelectionIds = [],
  activeTicketId = null,
  activeDragTarget = null,
}: KanbanColumnProps) {
  const { setCreateTicketOpen } = useUIStore()

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      column,
    },
  })

  // Exclude dragged tickets from SortableContext items to prevent transform calculation issues
  const ticketIds = column.tickets
    .filter((t) => !dragSelectionIds.includes(t.id) && t.id !== activeTicketId)
    .map((t) => t.id)

  return (
    <div
      className={cn(
        'flex h-full w-72 flex-shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/30',
        isOver && 'border-amber-500/50 bg-amber-500/5',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-zinc-200">{column.name}</h3>
          <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-zinc-800 text-xs text-zinc-400">
            {column.tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
            onClick={() => setCreateTicketOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Column content */}
      <ScrollArea className="flex-1 p-2">
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[100px]">
          <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
            {column.tickets.map((ticket, index) => {
              // Hide ticket if it's in the drag selection OR if it's the active ticket being dragged
              const isBeingDragged = dragSelectionIds.includes(ticket.id) || ticket.id === activeTicketId
              // Calculate the visual index (excluding dragged tickets)
              const visibleTickets = column.tickets.filter(
                (t) => !dragSelectionIds.includes(t.id) && t.id !== activeTicketId,
              )
              const visualIndex = visibleTickets.findIndex((t) => t.id === ticket.id)
              
              // Show insertion point before this ticket if it's the target
              const showInsertionPoint =
                activeDragTarget !== null &&
                !isBeingDragged &&
                visualIndex === activeDragTarget &&
                dragSelectionIds.length > 0

              return (
                <div key={ticket.id}>
                  {/* Show full-size placeholder before this ticket if it's the target */}
                  {showInsertionPoint && (
                    <div className="mb-2 rounded-lg border-2 border-amber-500/50 border-dashed bg-amber-500/10 min-h-[120px] flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-amber-500/70">Drop here</span>
                    </div>
                  )}
                  <KanbanCard
                    ticket={ticket}
                    projectKey={projectKey}
                    allTicketIds={ticketIds}
                    isBeingDragged={isBeingDragged}
                  />
                </div>
              )
            })}
          </SortableContext>

          {/* Show full-size placeholder at the end if target is beyond last ticket */}
          {activeDragTarget !== null &&
            activeDragTarget >=
              column.tickets.filter(
                (t) => !dragSelectionIds.includes(t.id) && t.id !== activeTicketId,
              ).length &&
            (dragSelectionIds.length > 0 || activeTicketId) && (
              <div className="mt-2 rounded-lg border-2 border-amber-500/50 border-dashed bg-amber-500/10 min-h-[120px] flex items-center justify-center pointer-events-none">
                <span className="text-xs text-amber-500/70">Drop here</span>
              </div>
            )}

          {/* Drop zone indicator when empty */}
          {column.tickets.length === 0 && (
            <div className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-800 rounded-lg">
              <span className="text-xs text-zinc-600">Drop tickets here</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add ticket button at bottom */}
      <div className="p-2 border-t border-zinc-800">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          onClick={() => setCreateTicketOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add ticket
        </Button>
      </div>
    </div>
  )
}
