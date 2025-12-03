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
import { useCallback, useMemo, useState } from 'react'
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
	const { selectedTicketIds, isSelected, clearSelection } = useSelectionStore()
	const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)

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
		}
	}, [])

	const handleDragOver = useCallback(
		(event: DragOverEvent) => {
			const { active, over } = event
			if (!over) return

			const activeId = active.id as string
			const overId = over.id as string

			// Find which column the active item is in
			const activeColumn = columns.find((col) => col.tickets.some((t) => t.id === activeId))
			// Find which column we're over
			const overColumn =
				columns.find((col) => col.id === overId) ||
				columns.find((col) => col.tickets.some((t) => t.id === overId))

			if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) {
				return
			}

			// Calculate new order
			const overTicketIndex = overColumn.tickets.findIndex((t) => t.id === overId)
			const newOrder = overTicketIndex >= 0 ? overTicketIndex : overColumn.tickets.length

			// Check if we're doing multi-select drag
			if (selectedTicketIds.size > 1 && isSelected(activeId)) {
				// Multi-drag: move all selected tickets
				const selectedIds = Array.from(selectedTicketIds)
				moveTickets(selectedIds, activeColumn.id, overColumn.id, newOrder)
			} else {
				// Single drag
				moveTicket(activeId, activeColumn.id, overColumn.id, newOrder)
			}
		},
		[columns, moveTicket, moveTickets, selectedTicketIds, isSelected],
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveTicket(null)

			const { active, over } = event
			if (!over) {
				// Drag cancelled - clear selection if we had multi-select
				if (selectedTicketIds.size > 1) {
					clearSelection()
				}
				return
			}

			const activeId = active.id as string
			const overId = over.id as string

			if (activeId === overId) return

			// Find which column the active item is in
			const activeColumn = columns.find((col) => col.tickets.some((t) => t.id === activeId))
			// Find which column we're over (could be a column or a ticket)
			const overColumn =
				columns.find((col) => col.id === overId) ||
				columns.find((col) => col.tickets.some((t) => t.id === overId))

			if (!activeColumn || !overColumn) return

			// Same column reordering
			if (activeColumn.id === overColumn.id) {
				const overTicketIndex = activeColumn.tickets.findIndex((t) => t.id === overId)
				if (overTicketIndex >= 0) {
					// Check if we're doing multi-select drag
					if (selectedTicketIds.size > 1 && isSelected(activeId)) {
						// Multi-drag: move all selected tickets at once
						const selectedIds = Array.from(selectedTicketIds)
						reorderTickets(activeColumn.id, selectedIds, overTicketIndex)
						clearSelection()
					} else {
						// Single drag
						reorderTicket(activeColumn.id, activeId, overTicketIndex)
					}
				}
			} else {
				// Cross-column move was handled in handleDragOver, just clear selection
				if (selectedTicketIds.size > 1 && isSelected(activeId)) {
					clearSelection()
				}
			}
		},
		[columns, reorderTicket, reorderTickets, selectedTicketIds, isSelected, clearSelection],
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

	return (
		<DndContext
			id="kanban-board-dnd"
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div className="flex gap-4 h-full overflow-x-auto pb-4">
				{filteredColumns.map((column) => (
					<KanbanColumn key={column.id} column={column} projectKey={projectKey} />
				))}
			</div>

			<DragOverlay>
				{activeTicket ? (
					<div className="rotate-3 scale-105 relative">
						<KanbanCard ticket={activeTicket} projectKey={projectKey} />
						{selectedTicketIds.size > 1 && isSelected(activeTicket.id) && (
							<div className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg">
								{selectedTicketIds.size}
							</div>
						)}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
