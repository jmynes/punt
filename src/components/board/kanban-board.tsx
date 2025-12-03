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
import { EmptyState } from '@/components/common/empty-state'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { KanbanCard } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
	projectKey: string
}

export function KanbanBoard({ projectKey }: KanbanBoardProps) {
	const { columns, moveTicket, moveTickets, reorderTicket, reorderTickets, searchQuery } = useBoardStore()
	const { setCreateTicketOpen } = useUIStore()
	// Note: we use useSelectionStore.getState().clearSelection() directly in handlers
	// to avoid dependency issues that can cause infinite loops
	const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)
	
	// Store the selection at drag start to ensure we have consistent state throughout the drag
	const [dragSelectionIds, setDragSelectionIds] = useState<string[]>([])

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

	const handleDragStart = useCallback((event: DragStartEvent) => {
		const { active } = event
		if (active.data.current?.type === 'ticket') {
			setActiveTicket(active.data.current.ticket)
			
			// Capture selection state at drag start (use getState to avoid stale closures)
			const selectionStore = useSelectionStore.getState()
			const currentSelection = selectionStore.selectedTicketIds
			const activeId = active.id as string
			
			// Only use multi-select if the dragged ticket is part of the selection
			if (currentSelection.size > 1 && currentSelection.has(activeId)) {
				setDragSelectionIds(Array.from(currentSelection))
			} else {
				// Dragging a non-selected ticket - clear selection and use just this ticket
				// Only clear if there's actually something selected to avoid unnecessary re-renders
				if (currentSelection.size > 0) {
					selectionStore.clearSelection()
				}
				setDragSelectionIds([activeId])
			}
		}
	}, [])

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
			const overColumn =
				columns.find((col) => col.id === overId) ||
				columns.find((col) => col.tickets.some((t) => t.id === overId))

			if (!activeColumn || !overColumn) return

			// Create a key for this operation to prevent duplicate calls
			const operationKey = `${activeId}-${overId}-${overColumn.id}`
			if (lastDragOperation.current === operationKey) {
				return // Skip duplicate operation
			}
			lastDragOperation.current = operationKey
			
			// Calculate target position
			const overTicketIndex = overColumn.tickets.findIndex((t) => t.id === overId)
			const newOrder = overTicketIndex >= 0 ? overTicketIndex : overColumn.tickets.length

			if (isMultiDrag) {
				// Check if all selected tickets are already in the target column
				const allInTargetColumn = dragSelectionIds.every((id) =>
					overColumn.tickets.some((t) => t.id === id)
				)
				
				if (allInTargetColumn) {
					// All selected tickets are in the same column
					// Check if ALL tickets in the column are selected (nothing to reorder around)
					const allColumnTicketsSelected = overColumn.tickets.every((t) =>
						dragSelectionIds.includes(t.id)
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
			
			// Reset drag state
			setActiveTicket(null)
			setDragSelectionIds([])
			lastDragOperation.current = null // Reset operation tracking

			// Clear selection after multi-drag completes
			if (wasMultiDrag) {
				useSelectionStore.getState().clearSelection()
			}
			
			// All actual moving/reordering is handled in handleDragOver
		},
		[dragSelectionIds],
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
					<div className="rotate-3 scale-105 relative">
						<KanbanCard ticket={activeTicket} projectKey={projectKey} />
						{dragSelectionIds.length > 1 && (
							<div className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
								{dragSelectionIds.length}
							</div>
						)}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
