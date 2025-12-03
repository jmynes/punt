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
import { useCallback, useState } from 'react'
import { EmptyState } from '@/components/common/empty-state'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { KanbanCard } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface KanbanBoardProps {
	projectKey: string
}

export function KanbanBoard({ projectKey }: KanbanBoardProps) {
	const { columns, moveTicket } = useBoardStore()
	const { setCreateTicketOpen } = useUIStore()
	const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null)

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

			moveTicket(activeId, activeColumn.id, overColumn.id, newOrder)
		},
		[columns, moveTicket],
	)

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		setActiveTicket(null)

		const { active, over } = event
		if (!over) return

		// Here you would sync with the server
		// For now, the optimistic update from handleDragOver is sufficient
		console.log('Drag ended:', { activeId: active.id, overId: over.id })
	}, [])

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
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div className="flex gap-4 h-full overflow-x-auto pb-4">
				{columns.map((column) => (
					<KanbanColumn key={column.id} column={column} projectKey={projectKey} />
				))}
			</div>

			<DragOverlay>
				{activeTicket ? (
					<div className="rotate-3 scale-105">
						<KanbanCard ticket={activeTicket} projectKey={projectKey} />
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}
