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

  // Track the active drag target for visual feedback
  const [activeDragTarget, setActiveDragTarget] = useState<{
    columnId: string
    insertIndex: number
  } | null>(null)

  // Track source columns for undo functionality
  const dragSourceColumns = useRef<Map<string, string>>(new Map())

  // Track original positions within source columns for preserving order
  const dragSourcePositions = useRef<Map<string, { columnOrder: number; ticketOrder: number }>>(new Map())

  // Track the original column state at drag start to calculate correct insertion positions and for undo
  const originalColumnState = useRef<Map<string, ColumnWithTickets>>(new Map())
  // Also store the original column order to restore columns in the exact same order
  const originalColumnOrder = useRef<ColumnWithTickets[]>([])

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

        // Track source columns and positions for all tickets being dragged
        dragSourceColumns.current = new Map()
        dragSourcePositions.current = new Map()

        // Store original column state at drag start to calculate correct insertion positions
        const currentColumns = useBoardStore.getState().columns
        originalColumnState.current = new Map()
        // Store the original column order as well
        originalColumnOrder.current = currentColumns.map((col) => ({
          ...col,
          tickets: col.tickets.map((t) => ({ ...t })), // Deep copy each ticket, preserving array order
        }))
        for (const col of originalColumnOrder.current) {
          // Deep copy the entire column, preserving ticket order exactly
          originalColumnState.current.set(col.id, {
            ...col,
            tickets: col.tickets.map((t) => ({ ...t })), // Deep copy each ticket, preserving array order
          })
        }

        // Only use multi-select if the dragged ticket is part of the selection
        if (currentSelection.size > 1 && currentSelection.has(activeId)) {
          const selectedIds = Array.from(currentSelection)
          setDragSelectionIds(selectedIds)

          // Record source column and position for each selected ticket
          // Use the original column state to get correct positions
          for (const ticketId of selectedIds) {
            // Find the column in the original state (from store, not filtered prop)
            let col = null
            for (const originalCol of currentColumns) {
              if (originalCol.tickets.some((t) => t.id === ticketId)) {
                col = originalCol
                break
              }
            }
            if (col) {
              dragSourceColumns.current.set(ticketId, col.id)
              const ticketOrder = col.tickets.findIndex((t) => t.id === ticketId)
              if (ticketOrder >= 0) {
                dragSourcePositions.current.set(ticketId, {
                  columnOrder: col.order,
                  ticketOrder,
                })
              }
            }
          }
        } else {
          // Dragging a non-selected ticket - clear selection and use just this ticket
          // Only clear if there's actually something selected to avoid unnecessary re-renders
          if (currentSelection.size > 0) {
            selectionStore.clearSelection()
          }
          setDragSelectionIds([activeId])

          // Record source column and position for the single ticket
          // Use the original column state to get correct positions
          let col = null
          for (const originalCol of currentColumns) {
            if (originalCol.tickets.some((t) => t.id === activeId)) {
              col = originalCol
              break
            }
          }
          if (col) {
            dragSourceColumns.current.set(activeId, col.id)
            const ticketOrder = col.tickets.findIndex((t) => t.id === activeId)
            if (ticketOrder >= 0) {
              dragSourcePositions.current.set(activeId, {
                columnOrder: col.order,
                ticketOrder,
              })
            }
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

      // Get current columns from store to ensure we have the latest state
      const currentColumns = useBoardStore.getState().columns

      // Find which column the active item is in (use original state to avoid issues with already-inserted tickets)
      const originalActiveColumn = originalColumnState.current.get(
        currentColumns.find((col) => col.tickets.some((t) => t.id === activeId))?.id || '',
      )
      const activeColumn = originalActiveColumn || currentColumns.find((col) => col.tickets.some((t) => t.id === activeId))

      // Find which column we're over (could be a column itself or a ticket in a column)
      // Check if we're hovering over a column (empty space) by checking the data type
      const isOverColumn = over.data.current?.type === 'column'
      const overColumnId = isOverColumn
        ? overId
        : currentColumns.find((col) => col.tickets.some((t) => t.id === overId))?.id
      
      if (!overColumnId) return
      
      // Use original column state to calculate insertion position correctly
      const originalOverColumn = originalColumnState.current.get(overColumnId)
      const overColumn = originalOverColumn || currentColumns.find((col) => col.id === overColumnId)

      if (!activeColumn || !overColumn) return

      // Create a key for this operation to prevent duplicate calls
      const operationKey = `${activeId}-${overId}-${overColumn.id}`
      if (lastDragOperation.current === operationKey) {
        return // Skip duplicate operation
      }
      lastDragOperation.current = operationKey

      // Calculate target position and update visual feedback
      // Behavior: insert BEFORE the ticket we're hovering over (or at the end if hovering over empty space)
      let newOrder: number
      if (isOverColumn) {
        // Hovering over column (empty space) - assume it's at the bottom (drop at the end)
        // For multi-drag, we need to exclude the tickets being dragged from the count
        const remainingTickets = overColumn.tickets.filter((t) => !dragSelectionIds.includes(t.id))
        newOrder = remainingTickets.length
      } else {
        // Hovering over a ticket
        const overTicketIndex = overColumn.tickets.findIndex((t) => t.id === overId)
        if (overTicketIndex >= 0) {
          // Check if we're moving from the same column
          const isSameColumn = activeColumn.id === overColumn.id
          
          if (isSameColumn) {
            // Same column reorder: insert at the target position (before the ticket)
            // The reorderTicket function handles the index adjustment correctly
            newOrder = overTicketIndex
          } else {
            // Cross-column move: insert at the target position (before the ticket)
            // For multi-drag, exclude dragged tickets that are already in target column
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

      // Calculate if we're inserting at the end (no tickets need to move)
      const remainingTickets = overColumn.tickets.filter((t) => !dragSelectionIds.includes(t.id))
      const isInsertingAtEnd = newOrder >= remainingTickets.length

      // Only update store during drag if tickets need to move (not inserting at end)
      // This prevents unnecessary movement when dragging to the bottom of a non-full column
      if (!isInsertingAtEnd) {
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
              // Still update visual feedback
              setActiveDragTarget({ columnId: overColumn.id, insertIndex: newOrder })
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
      }

      // Always update visual feedback target (even when not updating store)
      setActiveDragTarget({ columnId: overColumn.id, insertIndex: newOrder })
    },
    [moveTicket, moveTickets, reorderTicket, reorderTickets, dragSelectionIds],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const wasMultiDrag = dragSelectionIds.length > 1
      const sourceColumns = new Map(dragSourceColumns.current)

      // If we have an active drag target, ensure the final move happens
      // (in case we were inserting at the end and didn't update during drag)
      if (activeDragTarget) {
        const targetColumn = columns.find((c) => c.id === activeDragTarget.columnId)
        if (targetColumn) {
          const remainingTickets = targetColumn.tickets.filter(
            (t) => !dragSelectionIds.includes(t.id),
          )
          const isInsertingAtEnd = activeDragTarget.insertIndex >= remainingTickets.length

          // If we were inserting at the end, do the move now
          if (isInsertingAtEnd) {
            if (wasMultiDrag) {
              // Check if all selected tickets are already in the target column
              const allInTargetColumn = dragSelectionIds.every((id) =>
                targetColumn.tickets.some((t) => t.id === id),
              )

              if (allInTargetColumn) {
                // All selected tickets are in the same column - reorder
                reorderTickets(targetColumn.id, dragSelectionIds, activeDragTarget.insertIndex)
              } else {
                // Cross-column: move all selected tickets from any column
                moveTickets(dragSelectionIds, targetColumn.id, activeDragTarget.insertIndex)
              }
            } else {
              const activeId = event.active.id as string
              const activeColumn = columns.find((col) => col.tickets.some((t) => t.id === activeId))
              if (activeColumn) {
                if (activeColumn.id === targetColumn.id) {
                  // Same column - reorder
                  reorderTicket(activeColumn.id, activeId, activeDragTarget.insertIndex)
                } else {
                  // Cross-column
                  moveTicket(activeId, activeColumn.id, targetColumn.id, activeDragTarget.insertIndex)
                }
              }
            }
          }
        }
      }

      // Check if any tickets moved to a different column
      // Use current store state to ensure we detect moves to empty columns
      const currentStoreColumns = useBoardStore.getState().columns
      const moves: Array<{ ticketId: string; fromColumnId: string; toColumnId: string }> = []
      for (const ticketId of dragSelectionIds) {
        const fromColumnId = sourceColumns.get(ticketId)
        const toColumn = currentStoreColumns.find((c) => c.tickets.some((t) => t.id === ticketId))
        if (fromColumnId && toColumn && fromColumnId !== toColumn.id) {
          moves.push({ ticketId, fromColumnId, toColumnId: toColumn.id })
        }
      }

      // If there were cross-column moves, show toast and push to undo stack
      if (moves.length > 0) {
        const fromColumn = currentStoreColumns.find((c) => c.id === moves[0].fromColumnId)
        const toColumn = currentStoreColumns.find((c) => c.id === moves[0].toColumnId)
        const fromName = fromColumn?.name || 'Unknown'
        const toName = toColumn?.name || 'Unknown'

        // Look up ticket IDs from columns
        const allTickets = currentStoreColumns.flatMap((col) => col.tickets)
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
                // Restore the exact column state from before the drag started
                const boardStore = useBoardStore.getState()
                
                // Restore from the original column order to ensure exact preservation
                const restoredColumns = originalColumnOrder.current.map((originalCol) => {
                  // Deep copy the entire column with tickets in their original order
                  return {
                    ...originalCol,
                    tickets: originalCol.tickets.map((t) => ({ ...t })), // Deep copy, preserving array order
                  }
                })
                
                boardStore.setColumns(restoredColumns)
                toast.success('Move undone', { duration: 2000 })
              },
            },
          },
        )

        // Push to undo stack with original column state (before move) and after state (after move) for precise undo/redo
        useUndoStore
          .getState()
          .pushMove(
            moves,
            fromName,
            toName,
            toastId,
            Array.from(originalColumnOrder.current), // Before move
            currentStoreColumns.map((col) => ({
              ...col,
              tickets: col.tickets.map((t) => ({ ...t })), // Deep copy
            })), // After move
          )
      }

      // Reset drag state
      setActiveTicket(null)
      setDragSelectionIds([])
      setActiveDragTarget(null)
      lastDragOperation.current = null
      dragSourceColumns.current = new Map()
      dragSourcePositions.current = new Map()
      // Keep originalColumnState and originalColumnOrder for undo until next drag starts

      // Clear selection after multi-drag completes
      if (wasMultiDrag) {
        useSelectionStore.getState().clearSelection()
      }
    },
    [dragSelectionIds, columns, activeDragTarget, moveTicket, moveTickets, reorderTicket, reorderTickets],
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
          <KanbanColumn
            key={column.id}
            column={column}
            projectKey={projectKey}
            dragSelectionIds={dragSelectionIds}
            activeTicketId={activeTicket?.id}
            activeDragTarget={
              activeDragTarget?.columnId === column.id ? activeDragTarget.insertIndex : null
            }
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          dragSelectionIds.length > 1 ? (
            // Multi-drag: show actual ticket cards stacked, offset and tilted
            <div className="relative">
              {/* Get all tickets being dragged */}
              {(() => {
                const allTickets = columns.flatMap((col) => col.tickets)
                const draggedTickets = dragSelectionIds
                  .map((id) => allTickets.find((t) => t.id === id))
                  .filter(Boolean) as TicketWithRelations[]
                
                // Show up to 4 cards behind the primary one
                const visibleCount = Math.min(draggedTickets.length, 5)
                
                return (
                  <>
                    {/* Cards behind the primary one - actual KanbanCard components, offset and tilted */}
                    {Array.from({ length: visibleCount - 1 }, (_, index) => {
                      const cardIndex = index + 1
                      const ticket = draggedTickets[cardIndex]
                      if (!ticket) return null
                      
                      const offsetX = cardIndex * 3 // Progressive offset to the right
                      const offsetY = cardIndex * 4 // Progressive offset downward
                      const rotation = cardIndex * 1.5 // Slight rotation to the right
                      
                      return (
                        <div
                          key={ticket.id}
                          className="absolute [&_*]:text-transparent"
                          style={{
                            top: `${offsetY}px`,
                            left: `${offsetX}px`,
                            transform: `rotate(${rotation}deg)`,
                            zIndex: cardIndex,
                            pointerEvents: 'none',
                          }}
                        >
                          <KanbanCard ticket={ticket} projectKey={projectKey} />
                        </div>
                      )
                    })}
                    {/* Primary card (the one actually clicked/dragged) - at same position as single drag */}
                    <div className="relative rotate-3" style={{ zIndex: 10 }}>
                      <KanbanCard ticket={activeTicket} projectKey={projectKey} />
                      {/* Badge showing count - solid orange circle with white text */}
                      <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center z-20 shadow-sm">
                        {dragSelectionIds.length}
                      </div>
                    </div>
                  </>
                )
              })()}
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
