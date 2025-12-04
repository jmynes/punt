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
import type { TicketWithRelations } from '@/types'
import { KanbanCard } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
  projectKey: string
}

export function KanbanBoard({ projectKey }: KanbanBoardProps) {
  const { columns, moveTicket, moveTickets, reorderTicket, reorderTickets, searchQuery } =
    useBoardStore()
  const { setCreateTicketOpen } = useUIStore()
  // Note: we use useSelectionStore.getState().clearSelection() directly in handlers
  // to avoid dependency issues that can cause infinite loops
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)

  // Store the selection at drag start to ensure we have consistent state throughout the drag
  const [dragSelectionIds, setDragSelectionIds] = useState<string[]>([])

  // Track source columns for undo functionality
  const dragSourceColumns = useRef<Map<string, string>>(new Map())

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
      if (active.data.current?.type === 'ticket') {
        setActiveTicket(active.data.current.ticket)

        // Capture selection state at drag start (use getState to avoid stale closures)
        const selectionStore = useSelectionStore.getState()
        const currentSelection = selectionStore.selectedTicketIds
        const activeId = active.id as string

        // Track source columns for all tickets being dragged
        dragSourceColumns.current = new Map()

        // Only use multi-select if the dragged ticket is part of the selection
        if (currentSelection.size > 1 && currentSelection.has(activeId)) {
          const selectedIds = Array.from(currentSelection)
          setDragSelectionIds(selectedIds)

          // Record source column for each selected ticket
          for (const ticketId of selectedIds) {
            const col = columns.find((c) => c.tickets.some((t) => t.id === ticketId))
            if (col) {
              dragSourceColumns.current.set(ticketId, col.id)
            }
          }
        } else {
          // Dragging a non-selected ticket - clear selection and use just this ticket
          // Only clear if there's actually something selected to avoid unnecessary re-renders
          if (currentSelection.size > 0) {
            selectionStore.clearSelection()
          }
          setDragSelectionIds([activeId])

          // Record source column for the single ticket
          const col = columns.find((c) => c.tickets.some((t) => t.id === activeId))
          if (col) {
            dragSourceColumns.current.set(activeId, col.id)
          }
        }
      }
    },
    [columns],
  )

  // Track last drag operation to prevent duplicate state updates
  const lastDragOperation = useRef<string | null>(null)

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      // Don't do anything if hovering over self
      if (activeId === overId) return

      const isMultiDrag = dragSelectionIds.length > 1

      // If multi-dragging and hovering over another selected ticket, do nothing
      // (dragging within the selected group shouldn't reorder)
      if (isMultiDrag && dragSelectionIds.includes(overId)) {
        return
      }

      // Find which column the active item is in
      const activeColumn = columns.find((col) => col.tickets.some((t) => t.id === activeId))

      // Find which column we're over (could be a column itself or a ticket in a column)
      // Check if we're hovering over a column (empty space) by checking the data type
      const isOverColumn = over.data.current?.type === 'column'
      const overColumn = isOverColumn
        ? columns.find((col) => col.id === overId)
        : columns.find((col) => col.tickets.some((t) => t.id === overId))

      if (!activeColumn || !overColumn) return

      // Create a key for this operation to prevent duplicate calls
      const operationKey = `${activeId}-${overId}-${overColumn.id}`
      if (lastDragOperation.current === operationKey) {
        return // Skip duplicate operation
      }
      lastDragOperation.current = operationKey

      // Calculate target position
      // If hovering over the column itself (empty space), drop at the end
      // Otherwise, drop at the position of the ticket we're hovering over
      let newOrder: number
      if (isOverColumn) {
        // Hovering over column (empty space) - drop at the end
        // For multi-drag, we need to exclude the tickets being dragged from the count
        const remainingTickets = overColumn.tickets.filter((t) => !dragSelectionIds.includes(t.id))
        newOrder = remainingTickets.length
      } else {
        // Hovering over a ticket - drop at that ticket's position
        const overTicketIndex = overColumn.tickets.findIndex((t) => t.id === overId)
        if (overTicketIndex >= 0) {
          // For multi-drag, we need to account for tickets being dragged
          // If the target ticket is not being dragged, use its position
          // If it is being dragged, we need to find where it would be after removal
          if (isMultiDrag && dragSelectionIds.includes(overId)) {
            // Target ticket is part of the selection - this shouldn't happen due to early return
            // But as a fallback, calculate position after removing dragged tickets
            const remainingTickets = overColumn.tickets.filter(
              (t) => !dragSelectionIds.includes(t.id),
            )
            newOrder = remainingTickets.length
          } else {
            // Target ticket is not being dragged - use its position
            // For multi-drag, we need to exclude dragged tickets from the count
            if (isMultiDrag) {
              const remainingBeforeTarget = overColumn.tickets
                .slice(0, overTicketIndex)
                .filter((t) => !dragSelectionIds.includes(t.id))
              newOrder = remainingBeforeTarget.length
            } else {
              newOrder = overTicketIndex
            }
          }
        } else {
          // Fallback: drop at the end
          const remainingTickets = overColumn.tickets.filter(
            (t) => !dragSelectionIds.includes(t.id),
          )
          newOrder = remainingTickets.length
        }
      }

      if (isMultiDrag) {
        // Check if all selected tickets are already in the target column
        const allInTargetColumn = dragSelectionIds.every((id) =>
          overColumn.tickets.some((t) => t.id === id),
        )

        if (allInTargetColumn) {
          // All selected tickets are in the same column
          // Check if ALL tickets in the column are selected (nothing to reorder around)
          const allColumnTicketsSelected = overColumn.tickets.every((t) =>
            dragSelectionIds.includes(t.id),
          )

          if (allColumnTicketsSelected) {
            // All tickets in column are selected - nothing to reorder
            return
          }

          // Same column, but there are non-selected tickets - reorder around them
          reorderTickets(overColumn.id, dragSelectionIds, newOrder)
        } else {
          // Cross-column: move all selected tickets from any column
          moveTickets(dragSelectionIds, overColumn.id, newOrder)
        }
      } else {
        // Single drag
        if (activeColumn.id === overColumn.id) {
          // Same column - reorder
          reorderTicket(activeColumn.id, activeId, newOrder)
        } else {
          // Cross-column
          moveTicket(activeId, activeColumn.id, overColumn.id, newOrder)
        }
      }
    },
    [columns, moveTicket, moveTickets, reorderTicket, reorderTickets, dragSelectionIds],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const wasMultiDrag = dragSelectionIds.length > 1
      const sourceColumns = new Map(dragSourceColumns.current)

      // Check if any tickets moved to a different column
      const moves: Array<{ ticketId: string; fromColumnId: string; toColumnId: string }> = []
      for (const ticketId of dragSelectionIds) {
        const fromColumnId = sourceColumns.get(ticketId)
        const toColumn = columns.find((c) => c.tickets.some((t) => t.id === ticketId))
        if (fromColumnId && toColumn && fromColumnId !== toColumn.id) {
          moves.push({ ticketId, fromColumnId, toColumnId: toColumn.id })
        }
      }

      // If there were cross-column moves, show toast and push to undo stack
      if (moves.length > 0) {
        const fromColumn = columns.find((c) => c.id === moves[0].fromColumnId)
        const toColumn = columns.find((c) => c.id === moves[0].toColumnId)
        const fromName = fromColumn?.name || 'Unknown'
        const toName = toColumn?.name || 'Unknown'

        // Look up ticket IDs from columns
        const allTickets = columns.flatMap((col) => col.tickets)
        const ticketKeys = moves
          .map((move) => {
            const ticket = allTickets.find((t) => t.id === move.ticketId)
            return ticket ? `${projectKey}-${ticket.number}` : move.ticketId
          })
          .filter(Boolean)

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
                // Move tickets back
                const boardStore = useBoardStore.getState()
                for (const move of moves) {
                  boardStore.moveTicket(move.ticketId, move.toColumnId, move.fromColumnId, 0)
                }
                toast.success('Move undone', { duration: 2000 })
              },
            },
          },
        )

        // Push to undo stack
        useUndoStore.getState().pushMove(moves, fromName, toName, toastId)
      }

      // Reset drag state
      setActiveTicket(null)
      setDragSelectionIds([])
      lastDragOperation.current = null
      dragSourceColumns.current = new Map()

      // Clear selection after multi-drag completes
      if (wasMultiDrag) {
        useSelectionStore.getState().clearSelection()
      }
    },
    [dragSelectionIds, columns],
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

  // Clear selection when clicking on empty space
  const handleBoardClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking directly on the board background, not on a ticket
    const target = e.target as HTMLElement
    // Check if we clicked on the board container itself or a column container (not a ticket card)
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
          <KanbanColumn key={column.id} column={column} projectKey={projectKey} />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          dragSelectionIds.length > 1 ? (
            // Multi-drag: show stacked cards with primary ticket on top
            <div className="relative" style={{ width: '288px', height: '140px', overflow: 'visible' }}>
              {/* Stack of cards effect - show visible corners peeking out */}
              <div className="relative w-full h-full" style={{ overflow: 'visible' }}>
                {/* Bottom card - shows bottom-right corner */}
                <div
                  className="absolute rounded-lg border border-zinc-800 bg-zinc-900/50"
                  style={{
                    top: '6px',
                    left: '6px',
                    width: '272px',
                    height: '120px',
                    transform: 'rotate(-1.5deg)',
                    opacity: 0.35,
                    zIndex: 1,
                  }}
                />
                {/* Middle card - shows top-left corner */}
                <div
                  className="absolute rounded-lg border border-zinc-800 bg-zinc-900/60"
                  style={{
                    top: '-3px',
                    left: '-3px',
                    width: '272px',
                    height: '120px',
                    transform: 'rotate(1deg)',
                    opacity: 0.45,
                    zIndex: 2,
                  }}
                />
                {/* Second-to-top card - shows bottom-left corner */}
                <div
                  className="absolute rounded-lg border border-zinc-800 bg-zinc-900/70"
                  style={{
                    top: '3px',
                    left: '-2px',
                    width: '272px',
                    height: '120px',
                    transform: 'rotate(-0.5deg)',
                    opacity: 0.55,
                    zIndex: 3,
                  }}
                />
                {/* Top card (primary ticket - the one actually clicked/dragged) */}
                <div
                  className="absolute top-0 left-0 scale-105 shadow-2xl"
                  style={{ transform: 'translate(0, 0) rotate(1deg) scale(1.05)', zIndex: 10 }}
                >
                  <KanbanCard ticket={activeTicket} projectKey={projectKey} />
                  {/* Badge showing count */}
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg z-20 border-2 border-zinc-900">
                    {dragSelectionIds.length}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Single drag: show single card
            <div className="rotate-3 scale-105">
              <KanbanCard ticket={activeTicket} projectKey={projectKey} />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
