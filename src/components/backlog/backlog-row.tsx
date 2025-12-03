'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isBefore, isToday } from 'date-fns'
import { GripVertical } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BacklogColumn } from '@/stores/backlog-store'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { PriorityBadge } from '../common/priority-badge'
import { TypeBadge } from '../common/type-badge'

interface BacklogRowProps {
	ticket: TicketWithRelations
	projectKey: string
	columns: BacklogColumn[]
	getStatusName: (columnId: string) => string
	isDraggable?: boolean
}

export function BacklogRow({
	ticket,
	projectKey,
	columns,
	getStatusName,
	isDraggable = true,
}: BacklogRowProps) {
	const { setActiveTicketId } = useUIStore()

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: ticket.id,
		disabled: !isDraggable,
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	const handleClick = () => {
		setActiveTicketId(ticket.id)
		// Could also navigate to ticket detail page
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			handleClick()
		}
	}

	const renderCell = (column: BacklogColumn) => {
		switch (column.id) {
			case 'type':
				return <TypeBadge type={ticket.type} />

			case 'key':
				return (
					<span className="font-mono text-sm text-zinc-400">
						{projectKey}-{ticket.number}
					</span>
				)

			case 'title':
				return (
					<div className="flex items-center gap-2">
						<span className="truncate font-medium">{ticket.title}</span>
						{ticket._count && ticket._count.subtasks > 0 && (
							<Badge variant="outline" className="shrink-0 text-xs">
								{ticket._count.subtasks} subtasks
							</Badge>
						)}
					</div>
				)

			case 'status':
				return (
					<Badge variant="secondary" className="whitespace-nowrap">
						{getStatusName(ticket.columnId)}
					</Badge>
				)

			case 'priority':
				return <PriorityBadge priority={ticket.priority} showLabel />

			case 'assignee':
				return ticket.assignee ? (
					<div className="flex items-center gap-2">
						<Avatar className="h-5 w-5">
							<AvatarImage src={ticket.assignee.avatar || undefined} />
							<AvatarFallback className="text-[10px]">
								{ticket.assignee.name
									.split(' ')
									.map((n) => n[0])
									.join('')
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="truncate text-sm">{ticket.assignee.name}</span>
					</div>
				) : (
					<span className="text-zinc-500">Unassigned</span>
				)

			case 'reporter':
				return (
					<div className="flex items-center gap-2">
						<Avatar className="h-5 w-5">
							<AvatarImage src={ticket.creator.avatar || undefined} />
							<AvatarFallback className="text-[10px]">
								{ticket.creator.name
									.split(' ')
									.map((n) => n[0])
									.join('')
									.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="truncate text-sm">{ticket.creator.name}</span>
					</div>
				)

			case 'labels':
				return (
					<div className="flex flex-wrap gap-1">
						{ticket.labels.slice(0, 2).map((label) => (
							<Badge
								key={label.id}
								variant="outline"
								style={{
									borderColor: label.color,
									color: label.color,
								}}
								className="text-xs"
							>
								{label.name}
							</Badge>
						))}
						{ticket.labels.length > 2 && (
							<Badge variant="outline" className="text-xs">
								+{ticket.labels.length - 2}
							</Badge>
						)}
					</div>
				)

			case 'sprint':
				return ticket.sprint ? (
					<Badge
						variant="outline"
						className={cn(
							ticket.sprint.isActive
								? 'border-green-600 bg-green-900/30 text-green-400'
								: 'border-zinc-600 bg-zinc-800/50 text-zinc-300',
						)}
					>
						{ticket.sprint.name}
					</Badge>
				) : (
					<span className="text-zinc-500">—</span>
				)

			case 'storyPoints':
				return ticket.storyPoints !== null ? (
					<Badge variant="outline" className="font-mono">
						{ticket.storyPoints}
					</Badge>
				) : (
					<span className="text-zinc-500">—</span>
				)

			case 'estimate':
				return ticket.estimate ? (
					<span className="text-sm">{ticket.estimate}</span>
				) : (
					<span className="text-zinc-500">—</span>
				)

			case 'dueDate': {
				if (!ticket.dueDate) return <span className="text-zinc-500">—</span>
				const isOverdue = isBefore(ticket.dueDate, new Date()) && !isToday(ticket.dueDate)
				const isDueToday = isToday(ticket.dueDate)
				return (
					<span
						className={cn(
							'text-sm',
							isOverdue && 'font-medium text-red-400',
							isDueToday && 'font-medium text-amber-400',
						)}
					>
						{format(ticket.dueDate, 'MMM d, yyyy')}
					</span>
				)
			}

			case 'created':
				return (
					<span className="text-sm text-zinc-400">{format(ticket.createdAt, 'MMM d, yyyy')}</span>
				)

			case 'updated':
				return (
					<span className="text-sm text-zinc-400">{format(ticket.updatedAt, 'MMM d, yyyy')}</span>
				)

			case 'parent':
				return ticket.parentId ? (
					<span className="text-sm text-zinc-400">{ticket.parentId}</span>
				) : (
					<span className="text-zinc-500">—</span>
				)

			default:
				return null
		}
	}

	return (
		<tr
			ref={setNodeRef}
			style={style}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			className={cn(
				'group cursor-pointer border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50 focus:bg-zinc-800/50 focus:outline-none select-none',
				isDragging && 'opacity-50 bg-zinc-800 shadow-lg',
			)}
		>
			{/* Drag handle cell - always render to maintain table alignment */}
			<td className="w-8 px-1 py-2">
				{isDraggable && (
					<button
						type="button"
						{...attributes}
						{...listeners}
						className="flex h-6 w-6 cursor-grab items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 active:cursor-grabbing transition-opacity"
						onClick={(e) => e.stopPropagation()}
					>
						<GripVertical className="h-4 w-4 text-zinc-500" />
					</button>
				)}
			</td>
			{columns.map((column) => (
				<td
					key={column.id}
					style={{
						width: column.width || undefined,
						minWidth: column.minWidth,
					}}
					className="px-3 py-2"
				>
					{renderCell(column)}
				</td>
			))}
		</tr>
	)
}
