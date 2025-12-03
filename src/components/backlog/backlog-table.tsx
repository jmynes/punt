'use client'

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Settings2 } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useBacklogStore } from '@/stores/backlog-store'
import type { ColumnWithTickets, TicketWithRelations } from '@/types'
import { BacklogFilters } from './backlog-filters'
import { BacklogHeader } from './backlog-header'
import { BacklogRow } from './backlog-row'

interface BacklogTableProps {
	tickets: TicketWithRelations[]
	columns: ColumnWithTickets[]
	projectKey: string
}

export function BacklogTable({ tickets, columns: statusColumns, projectKey }: BacklogTableProps) {
	const {
		columns,
		reorderColumns,
		sort,
		filterByType,
		filterByPriority,
		filterByAssignee,
		filterBySprint,
		searchQuery,
		showSubtasks,
		setColumnConfigOpen,
	} = useBacklogStore()

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	// Filter and sort tickets
	const filteredTickets = useMemo(() => {
		let result = [...tickets]

		// Filter out subtasks if disabled
		if (!showSubtasks) {
			result = result.filter((t) => t.type !== 'subtask')
		}

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			result = result.filter(
				(t) =>
					t.title.toLowerCase().includes(query) ||
					`${projectKey}-${t.number}`.toLowerCase().includes(query) ||
					t.description?.toLowerCase().includes(query),
			)
		}

		// Type filter
		if (filterByType.length > 0) {
			result = result.filter((t) => filterByType.includes(t.type))
		}

		// Priority filter
		if (filterByPriority.length > 0) {
			result = result.filter((t) => filterByPriority.includes(t.priority))
		}

		// Assignee filter
		if (filterByAssignee.length > 0) {
			result = result.filter((t) => filterByAssignee.includes(t.assigneeId || 'unassigned'))
		}

		// Sprint filter
		if (filterBySprint) {
			if (filterBySprint === 'backlog') {
				result = result.filter((t) => !t.sprintId)
			} else {
				result = result.filter((t) => t.sprintId === filterBySprint)
			}
		}

		// Sort
		if (sort) {
			result.sort((a, b) => {
				let aVal: string | number | Date | null = null
				let bVal: string | number | Date | null = null

				switch (sort.column) {
					case 'key':
						aVal = a.number
						bVal = b.number
						break
					case 'title':
						aVal = a.title.toLowerCase()
						bVal = b.title.toLowerCase()
						break
					case 'type':
						aVal = a.type
						bVal = b.type
						break
					case 'status':
						aVal = a.columnId
						bVal = b.columnId
						break
					case 'priority': {
						const priorityOrder = ['critical', 'highest', 'high', 'medium', 'low', 'lowest']
						aVal = priorityOrder.indexOf(a.priority)
						bVal = priorityOrder.indexOf(b.priority)
						break
					}
					case 'assignee':
						aVal = a.assignee?.name.toLowerCase() || 'zzz'
						bVal = b.assignee?.name.toLowerCase() || 'zzz'
						break
					case 'reporter':
						aVal = a.creator.name.toLowerCase()
						bVal = b.creator.name.toLowerCase()
						break
					case 'sprint':
						aVal = a.sprint?.name.toLowerCase() || 'zzz'
						bVal = b.sprint?.name.toLowerCase() || 'zzz'
						break
					case 'storyPoints':
						aVal = a.storyPoints ?? -1
						bVal = b.storyPoints ?? -1
						break
					case 'estimate':
						aVal = a.estimate || ''
						bVal = b.estimate || ''
						break
					case 'dueDate':
						aVal = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
						bVal = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
						break
					case 'created':
						aVal = a.createdAt.getTime()
						bVal = b.createdAt.getTime()
						break
					case 'updated':
						aVal = a.updatedAt.getTime()
						bVal = b.updatedAt.getTime()
						break
					case 'parent':
						aVal = a.parentId || 'zzz'
						bVal = b.parentId || 'zzz'
						break
				}

				if (aVal === null || bVal === null) return 0
				if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
				if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
				return 0
			})
		}

		return result
	}, [
		tickets,
		showSubtasks,
		searchQuery,
		filterByType,
		filterByPriority,
		filterByAssignee,
		filterBySprint,
		sort,
		projectKey,
	])

	const visibleColumns = columns.filter((c) => c.visible)
	const columnIds = visibleColumns.map((c) => c.id)

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (over && active.id !== over.id) {
			const oldIndex = columns.findIndex((c) => c.id === active.id)
			const newIndex = columns.findIndex((c) => c.id === over.id)
			reorderColumns(oldIndex, newIndex)
		}
	}

	// Get status name from columnId
	const getStatusName = (columnId: string) => {
		const col = statusColumns.find((c) => c.id === columnId)
		return col?.name || 'Unknown'
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
				<BacklogFilters statusColumns={statusColumns} />
				<Button
					variant="outline"
					size="sm"
					onClick={() => setColumnConfigOpen(true)}
					className="shrink-0"
				>
					<Settings2 className="mr-2 h-4 w-4" />
					Columns
				</Button>
			</div>

			{/* Table */}
			<ScrollArea className="flex-1">
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					<table className="w-full border-collapse">
						<thead className="sticky top-0 z-10 bg-zinc-900">
							<SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
								<tr className="border-b border-zinc-800">
									{visibleColumns.map((column) => (
										<BacklogHeader key={column.id} column={column} />
									))}
								</tr>
							</SortableContext>
						</thead>
						<tbody>
							{filteredTickets.map((ticket) => (
								<BacklogRow
									key={ticket.id}
									ticket={ticket}
									projectKey={projectKey}
									columns={visibleColumns}
									getStatusName={getStatusName}
								/>
							))}
						</tbody>
					</table>
				</DndContext>

				{filteredTickets.length === 0 && (
					<div className="flex h-40 items-center justify-center text-zinc-500">
						No tickets found
					</div>
				)}

				<ScrollBar orientation="horizontal" />
			</ScrollArea>

			{/* Footer */}
			<div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-sm text-zinc-500">
				<span>
					{filteredTickets.length} of {tickets.length} tickets
				</span>
			</div>
		</div>
	)
}
