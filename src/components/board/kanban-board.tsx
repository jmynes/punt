'use client'

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Layers } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { KanbanCard } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
  projectKey: string
}

export function KanbanBoard({ projectKey }: KanbanBoardProps) {
  const { columns, moveTicket, moveTickets, reorderTicket, reorderTickets, searchQuery } =
    useBoardStore()
  const { setCreateTicketOpen } = useUIStore()
  
  // Drag state - only for visual feedback, no store updates during drag
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
  const [draggingTicketIds, setDraggingTicketIds] = useState<string[]>([])
  const [insertPosition, setInsertPosition] = useState<{
    columnId: string
    index: number
  } | null>(null)

  // Refs for drag operation (no re-renders)
  const beforeDragSnapshot = useRef<ColumnWithTickets[] | null>(null)
  const draggedIdsRef = useRef<string[]>([])

  // Filter tickets based on search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns

    const query = searchQuery.toLowerCase()
    return columns.map((column) => ({
      ...column,
      tickets: column.tickets.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(query) ||
          `${projectKey}-${ticket.number}`.toLowerCase().includes(query) ||
          ticket.description?.toLowerCase().includes(query) ||
          ticket.labels.some((label) => label.name.toLowerCase().includes(query)),
      ),
    }))
  }, [columns, searchQuery, projectKey])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      if (active.data.current?.type !== 'ticket') return

      const ticket = active.data.current.ticket as TicketWithRelations
      setActiveTicket(ticket)

      // Determine which tickets are being dragged
      const selectionStore = useSelectionStore.getState()
      const selectedIds = Array.from(selectionStore.selectedTicketIds)
      const activeId = active.id as string

      let ticketIds: string[]
      if (selectedIds.length > 1 && selectedIds.includes(activeId)) {
        ticketIds = selectedIds
      } else {
        if (selectedIds.length > 0) {
          selectionStore.clearSelection()
        }
        ticketIds = [activeId]
      }

      setDraggingTicketIds(ticketIds)
      draggedIdsRef.current = ticketIds

      // Save snapshot for undo
      beforeDragSnapshot.current = columns.map((col) => ({
        ...col,
        tickets: col.tickets.map((t) => ({ ...t })),
      }))
    },
    [columns],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) {
        setInsertPosition(null)
        return
      }

      const activeId = active.id as string
      const overId = over.id as string
      const draggedIds = draggedIdsRef.current

      // Use beforeDragSnapshot for calculations (stable reference)
      const snapshotColumns = beforeDragSnapshot.current
      if (!snapshotColumns) return

      // Find which column we're hovering over
      const isOverColumn = over.data.current?.type === 'column'
      const isOverColumnEnd = over.data.current?.type === 'column-end'
      let targetColumnId: string | undefined
      let isHoveringOverDraggedTicket = false
      let forceInsertAtEnd = false

      if (isOverColumn) {
        targetColumnId = overId
      } else if (isOverColumnEnd) {
        // Hovering over the "drop at end" zone
        targetColumnId = over.data.current?.columnId
        forceInsertAtEnd = true
      } else {
        // Check if hovering over a dragged ticket (it's hidden but still in DOM)
        if (draggedIds.includes(overId)) {
          isHoveringOverDraggedTicket = true
          // Find which column the dragged ticket is from
          const draggedTicketColumn = snapshotColumns.find((col) =>
            col.tickets.some((t) => t.id === overId),
          )
          targetColumnId = draggedTicketColumn?.id
        } else {
          const targetColumn = snapshotColumns.find((col) => col.tickets.some((t) => t.id === overId))
          targetColumnId = targetColumn?.id
        }
      }

      if (!targetColumnId) return

      const targetColumn = snapshotColumns.find((col) => col.id === targetColumnId)
      if (!targetColumn) return

      // Calculate insertion index (excluding dragged tickets)
      const visibleTickets = targetColumn.tickets.filter((t) => !draggedIds.includes(t.id))

      let insertIndex: number
      if (isOverColumn || isOverColumnEnd || forceInsertAtEnd) {
        // Insert at the end of the column
        insertIndex = visibleTickets.length
      } else if (isHoveringOverDraggedTicket) {
        // Hovering over a dragged ticket's original position
        // Find its original index and use that as the insert position
        const originalIndex = targetColumn.tickets.findIndex((t) => t.id === overId)
        // Count how many visible tickets are before this position
        const ticketsBefore = targetColumn.tickets.slice(0, originalIndex)
        insertIndex = ticketsBefore.filter((t) => !draggedIds.includes(t.id)).length
      } else {
        const overTicketIndex = visibleTickets.findIndex((t) => t.id === overId)
        insertIndex = overTicketIndex >= 0 ? overTicketIndex : visibleTickets.length
      }

      // Only update visual feedback (no store updates)
      setInsertPosition({ columnId: targetColumnId, index: insertIndex })
    },
    [], // No dependencies - uses refs
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedIds = draggedIdsRef.current
      const snapshot = beforeDragSnapshot.current

      if (!insertPosition || !snapshot || draggedIds.length === 0) {
        // Cleanup
        setActiveTicket(null)
        setDraggingTicketIds([])
        setInsertPosition(null)
        beforeDragSnapshot.current = null
        draggedIdsRef.current = []
        return
      }

      // Find source column from snapshot
      const sourceColumn = snapshot.find((col) =>
        col.tickets.some((t) => t.id === draggedIds[0]),
      )

      if (!sourceColumn) {
        // Cleanup
        setActiveTicket(null)
        setDraggingTicketIds([])
        setInsertPosition(null)
        beforeDragSnapshot.current = null
        draggedIdsRef.current = []
        return
      }

      const targetColumnId = insertPosition.columnId
      const insertIndex = insertPosition.index
      const isSameColumn = sourceColumn.id === targetColumnId
      const isSingleDrag = draggedIds.length === 1

      // Apply the move NOW (only on drop)
      if (isSingleDrag) {
        if (isSameColumn) {
          reorderTicket(targetColumnId, draggedIds[0], insertIndex)
        } else {
          moveTicket(draggedIds[0], sourceColumn.id, targetColumnId, insertIndex)
        }
      } else {
        const allFromSameColumn = draggedIds.every((id) =>
          sourceColumn.tickets.some((t) => t.id === id),
        )
        if (allFromSameColumn && isSameColumn) {
          reorderTickets(targetColumnId, draggedIds, insertIndex)
        } else {
          moveTickets(draggedIds, targetColumnId, insertIndex)
        }
      }

      // Check for cross-column moves for undo/notification
      if (!isSameColumn) {
        const afterColumns = useBoardStore.getState().columns
        const fromName = sourceColumn.name
        const toColumn = afterColumns.find((col) => col.id === targetColumnId)
        const toName = toColumn?.name || 'Unknown'

        const allTickets = afterColumns.flatMap((col) => col.tickets)
        const ticketKeys = draggedIds
          .map((id) => {
            const ticket = allTickets.find((t) => t.id === id)
            return ticket ? `${projectKey}-${ticket.number}` : id
          })
          .filter(Boolean)

        const moves = draggedIds.map((id) => ({
          ticketId: id,
          fromColumnId: sourceColumn.id,
          toColumnId: targetColumnId,
        }))

        const toastId = toast.success(
          moves.length === 1 ? 'Ticket moved' : `${moves.length} tickets moved`,
          {
            description:
              moves.length === 1
                ? `${ticketKeys[0]} moved to ${toName}`
                : `${ticketKeys.join(', ')} moved to ${toName}`,
            duration: 5000,
            action: {
              label: 'Undo',
              onClick: () => {
                useBoardStore.getState().setColumns(snapshot)
                toast.success('Move undone', { duration: 2000 })
              },
            },
          },
        )

        useUndoStore.getState().pushMove(
          moves,
          fromName,
          toName,
          toastId,
          snapshot,
          afterColumns.map((col) => ({
            ...col,
            tickets: col.tickets.map((t) => ({ ...t })),
          })),
        )
      }

      // Cleanup
      setActiveTicket(null)
      setDraggingTicketIds([])
      setInsertPosition(null)
      beforeDragSnapshot.current = null
      draggedIdsRef.current = []

      // Clear selection after multi-drag
      if (draggedIds.length > 1) {
        useSelectionStore.getState().clearSelection()
      }
    },
    [insertPosition, moveTicket, moveTickets, projectKey, reorderTicket, reorderTickets],
  )

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No columns yet"
        description="Create columns to organize your tickets on the board."
        action={{
          label: 'Create First Ticket',
          onClick: () => setCreateTicketOpen(true),
        }}
      />
    )
  }

  const handleBoardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest('[data-ticket-card]') === null &&
      useSelectionStore.getState().selectedTicketIds.size > 0
    ) {
      useSelectionStore.getState().clearSelection()
    }
  }, [])

  return (
    <DndContext
      id="kanban-board-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4" onClick={handleBoardClick}>
        {filteredColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            projectKey={projectKey}
            dragSelectionIds={draggingTicketIds}
            activeTicketId={activeTicket?.id || null}
            activeDragTarget={
              insertPosition?.columnId === column.id ? insertPosition.index : null
            }
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          draggingTicketIds.length > 1 ? (
            <div className="relative">
              {(() => {
                // Use snapshot for stable ticket references
                const allTickets = beforeDragSnapshot.current?.flatMap((col) => col.tickets) || []
                const draggedTickets = draggingTicketIds
                  .map((id) => allTickets.find((t) => t.id === id))
                  .filter(Boolean) as TicketWithRelations[]

                const visibleCount = Math.min(draggedTickets.length, 5)

                return (
                  <>
                    {Array.from({ length: visibleCount - 1 }, (_, index) => {
                      const cardIndex = index + 1
                      const ticket = draggedTickets[cardIndex]
                      if (!ticket) return null

                      return (
                        <div
                          key={ticket.id}
                          className="absolute [&_*]:text-transparent"
                          style={{
                            top: `${cardIndex * 4}px`,
                            left: `${cardIndex * 3}px`,
                            transform: `rotate(${cardIndex * 1.5}deg)`,
                            zIndex: cardIndex,
                            pointerEvents: 'none',
                          }}
                        >
                          <KanbanCard ticket={ticket} projectKey={projectKey} />
                        </div>
                      )
                    })}
                    <div className="relative rotate-3" style={{ zIndex: 10 }}>
                      <KanbanCard ticket={activeTicket} projectKey={projectKey} />
                      <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center z-20 shadow-sm">
                        {draggingTicketIds.length}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          ) : (
            <div className="rotate-3 scale-105">
              <KanbanCard ticket={activeTicket} projectKey={projectKey} />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
