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
import { useCallback, useRef, useState } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { useMoveTicket, useMoveTickets } from '@/hooks/queries/use-tickets'
import { getStatusIcon } from '@/lib/status-icons'
import { showUndoRedoToast } from '@/lib/undo-toast'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import { useUndoStore } from '@/stores/undo-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { KanbanCard } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
  projectKey: string
  projectId: string
  filteredColumns: ColumnWithTickets[]
}

export function KanbanBoard({ projectKey, projectId, filteredColumns }: KanbanBoardProps) {
  const { getColumns, moveTicket, moveTickets, reorderTicket, reorderTickets, _hasHydrated } =
    useBoardStore()
  const { setCreateTicketOpen } = useUIStore()

  // API mutations
  const moveTicketMutation = useMoveTicket()
  const moveTicketsMutation = useMoveTickets()

  // Get unfiltered columns for drag/drop operations (need full data for snapshots)
  const columns = getColumns(projectId)

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

      const _activeId = active.id as string
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
          const targetColumn = snapshotColumns.find((col) =>
            col.tickets.some((t) => t.id === overId),
          )
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
    (_event: DragEndEvent) => {
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
      const sourceColumn = snapshot.find((col) => col.tickets.some((t) => t.id === draggedIds[0]))

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

      // Apply the move NOW (only on drop) - optimistic update
      if (isSingleDrag) {
        if (isSameColumn) {
          reorderTicket(projectId, targetColumnId, draggedIds[0], insertIndex)
        } else {
          moveTicket(projectId, draggedIds[0], sourceColumn.id, targetColumnId, insertIndex)
        }
      } else {
        const allFromSameColumn = draggedIds.every((id) =>
          sourceColumn.tickets.some((t) => t.id === id),
        )
        if (allFromSameColumn && isSameColumn) {
          reorderTickets(projectId, targetColumnId, draggedIds, insertIndex)
        } else {
          moveTickets(projectId, draggedIds, targetColumnId, insertIndex)
        }
      }

      // Get after state for undo
      const afterColumns = useBoardStore.getState().getColumns(projectId)
      const afterSnapshot = afterColumns.map((col) => ({
        ...col,
        tickets: col.tickets.map((t) => ({ ...t })),
      }))
      const showUndo = useUIStore.getState().showUndoButtons

      // Check for cross-column moves for undo/notification
      if (!isSameColumn) {
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

        const toastTitle =
          moves.length === 1
            ? `Ticket moved from ${fromName}`
            : `${moves.length} tickets moved from ${fromName}`
        const { icon: StatusIcon, color: statusColor } = getStatusIcon(toName)

        const toastDescription =
          moves.length === 1 ? (
            <div className="flex items-center gap-1.5">
              <span>{`${ticketKeys[0]} Moved to`}</span>
              <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
              <span>{toName}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {ticketKeys.map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span>{`${k} Moved to`}</span>
                  <StatusIcon className={`h-4 w-4 ${statusColor}`} aria-hidden />
                  <span>{toName}</span>
                </div>
              ))}
            </div>
          )

        const toastId = showUndoRedoToast('success', {
          title: toastTitle,
          description: toastDescription,
          duration: 5000,
          showUndoButtons: showUndo,
          onUndo: () => useBoardStore.getState().setColumns(projectId, snapshot),
          onRedo: () => useBoardStore.getState().setColumns(projectId, afterSnapshot),
          undoneTitle: 'Move undone',
          redoneTitle: toastTitle,
          redoneDescription: toastDescription,
        })

        useUndoStore
          .getState()
          .pushMove(projectId, moves, fromName, toName, toastId, snapshot, afterSnapshot)
      } else {
        // Same-column reorder - also register undo
        const allTickets = afterColumns.flatMap((col) => col.tickets)
        const ticketKeys = draggedIds
          .map((id) => {
            const ticket = allTickets.find((t) => t.id === id)
            return ticket ? `${projectKey}-${ticket.number}` : id
          })
          .filter(Boolean)

        const toastTitle =
          draggedIds.length === 1 ? 'Ticket reordered' : `${draggedIds.length} tickets reordered`

        const toastDescription =
          draggedIds.length === 1
            ? `${ticketKeys[0]} moved within ${sourceColumn.name}`
            : `${ticketKeys.join(', ')} moved within ${sourceColumn.name}`

        const toastId = showUndoRedoToast('success', {
          title: toastTitle,
          description: toastDescription,
          duration: 5000,
          showUndoButtons: showUndo,
          onUndo: () => useBoardStore.getState().setColumns(projectId, snapshot),
          onRedo: () => useBoardStore.getState().setColumns(projectId, afterSnapshot),
          undoneTitle: 'Reorder undone',
          redoneTitle: toastTitle,
          redoneDescription: toastDescription,
        })

        // Use fake moves since it's a reorder within the same column
        const fakeMoves = draggedIds.map((id) => ({
          ticketId: id,
          fromColumnId: sourceColumn.id,
          toColumnId: sourceColumn.id,
        }))

        useUndoStore
          .getState()
          .pushMove(
            projectId,
            fakeMoves,
            sourceColumn.name,
            sourceColumn.name,
            toastId,
            snapshot,
            afterSnapshot,
          )
      }

      // Persist to API (after optimistic update)
      if (isSingleDrag) {
        // Single ticket move/reorder
        moveTicketMutation.mutate({
          projectId,
          ticketId: draggedIds[0],
          fromColumnId: sourceColumn.id,
          toColumnId: targetColumnId,
          newOrder: insertIndex,
          previousColumns: snapshot,
        })
      } else {
        // Multiple tickets move
        moveTicketsMutation.mutate({
          projectId,
          ticketIds: draggedIds,
          toColumnId: targetColumnId,
          newOrder: insertIndex,
          previousColumns: snapshot,
        })
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
    [
      insertPosition,
      moveTicket,
      moveTickets,
      projectId,
      projectKey,
      reorderTicket,
      reorderTickets,
      moveTicketMutation,
      moveTicketsMutation,
    ],
  )

  const handleBoardClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest('[data-ticket-card]') === null &&
      useSelectionStore.getState().selectedTicketIds.size > 0
    ) {
      useSelectionStore.getState().clearSelection()
    }
  }, [])

  // Show loading skeleton until Zustand hydrates from localStorage
  if (!_hasHydrated) {
    return (
      <div className="flex gap-4 h-full min-h-0 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="flex w-72 flex-shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/30 max-h-full min-h-0"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-zinc-800 animate-pulse" />
                <div className="h-4 w-16 rounded bg-zinc-800 animate-pulse" />
                <div className="h-5 w-5 rounded-full bg-zinc-800 animate-pulse" />
              </div>
            </div>
            <div className="flex-1 p-2">
              <div className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-800 rounded-lg">
                <span className="text-xs text-zinc-600">Loading...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext
      id="kanban-board-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {columns.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No columns yet"
          description="Create columns to organize your tickets on the board."
          action={{
            label: 'Create First Ticket',
            onClick: () => setCreateTicketOpen(true),
          }}
        />
      ) : (
        <div className="flex gap-4 h-full min-h-0 overflow-x-auto pb-4" onClick={handleBoardClick}>
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
      )}

      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          draggingTicketIds.length > 1 ? (
            (() => {
              // Calculate how many background cards to show (max 3 behind the main card)
              const stackCount = Math.min(draggingTicketIds.length, 4)
              const cardWidth = 272

              return (
                <div
                  className="relative"
                  style={{
                    // Account for horizontal offset of fanned cards
                    width: cardWidth + (stackCount - 1) * 10,
                    marginLeft: (stackCount - 1) * 10,
                  }}
                >
                  {/* Fanned card stack - cards behind main card, offset to the left */}
                  {Array.from({ length: stackCount - 1 }, (_, i) => {
                    // i=0 is furthest back, higher i is closer to front
                    const reverseIndex = stackCount - 2 - i
                    const offset = (reverseIndex + 1) * 10
                    const rotation = (reverseIndex + 1) * -0.8
                    // Amber intensity increases toward front of stack
                    const amberOpacity = 0.06 + i * 0.02

                    return (
                      <div
                        key={`stack-${i}`}
                        className="absolute top-0 rounded-lg"
                        style={{
                          width: cardWidth,
                          height: '100%',
                          right: offset,
                          transform: `rotate(${rotation}deg)`,
                          transformOrigin: 'bottom right',
                          zIndex: i,
                          // Amber-tinted background matching selection state
                          background: `linear-gradient(135deg,
                            rgba(245, 158, 11, ${amberOpacity}) 0%,
                            rgba(217, 119, 6, ${amberOpacity * 0.8}) 100%)`,
                          // Amber border + outer glow
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          boxShadow: `
                            0 0 0 1px rgba(245, 158, 11, 0.15),
                            0 2px 4px rgba(0,0,0,0.3),
                            0 4px 8px rgba(0,0,0,0.2),
                            inset 0 1px 0 rgba(245, 158, 11, 0.1)
                          `,
                        }}
                      >
                        {/* Inner card surface */}
                        <div
                          className="absolute inset-[1px] rounded-[7px]"
                          style={{
                            background: `linear-gradient(180deg,
                              rgba(39, 39, 42, 0.95) 0%,
                              rgba(24, 24, 27, 0.98) 100%)`,
                          }}
                        />
                        {/* Amber edge highlight on left side (visible part) */}
                        <div
                          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                          style={{
                            background: `linear-gradient(180deg,
                              rgba(251, 191, 36, 0.4) 0%,
                              rgba(245, 158, 11, 0.6) 50%,
                              rgba(251, 191, 36, 0.4) 100%)`,
                          }}
                        />
                      </div>
                    )
                  })}

                  {/* Main card - front of the stack */}
                  <div
                    className="relative rounded-lg"
                    style={{
                      width: cardWidth,
                      marginLeft: 'auto',
                      zIndex: stackCount,
                      // Amber selection ring matching the stack cards
                      boxShadow: `
                        0 0 0 2px rgba(245, 158, 11, 0.8),
                        0 0 12px rgba(245, 158, 11, 0.25),
                        0 8px 16px rgba(0,0,0,0.4),
                        0 2px 6px rgba(0,0,0,0.3)
                      `,
                    }}
                  >
                    <KanbanCard ticket={activeTicket} projectKey={projectKey} />

                    {/* Selection count badge */}
                    <div className="absolute -top-2.5 -right-2.5 z-20">
                      <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-amber-500 rounded-full blur-md opacity-50" />
                        {/* Badge */}
                        <div
                          className="relative text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center border"
                          style={{
                            background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                            borderColor: 'rgba(251, 191, 36, 0.5)',
                            color: '#1c1917',
                            boxShadow:
                              '0 2px 8px rgba(217, 119, 6, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                          }}
                        >
                          {draggingTicketIds.length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div
              className="w-[272px]"
              style={{
                filter:
                  'drop-shadow(0 8px 16px rgba(0,0,0,0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <KanbanCard ticket={activeTicket} projectKey={projectKey} />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
