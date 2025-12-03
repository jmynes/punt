'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isBefore, isToday } from 'date-fns'
import { GripVertical, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BacklogColumn } from '@/stores/backlog-store'
import { useSelectionStore } from '@/stores/selection-store'
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
	allTicketIds: string[]
}

export function BacklogRow({
	ticket,
	projectKey,
	columns,
	getStatusName,
	isDraggable = true,
	allTicketIds,
}: BacklogRowProps) {
	const { setActiveTicketId } = useUIStore()
	const { isSelected, selectTicket, toggleTicket, selectRange } = useSelectionStore()
	const selected = isSelected(ticket.id)

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: ticket.id,
		disabled: !isDraggable,
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	const handleClick = (e: React.MouseEvent) => {
		// Ctrl/Cmd + click: toggle selection (don't open detail)
		if (e.ctrlKey || e.metaKey) {
			toggleTicket(ticket.id)
			return
		}

		// Shift + click: range selection (don't open detail)
		if (e.shiftKey) {
			selectRange(ticket.id, allTicketIds)
			return
		}

		// Normal click: open ticket detail (and select only this one)
		selectTicket(ticket.id)
		setActiveTicketId(ticket.id)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			selectTicket(ticket.id)
			setActiveTicketId(ticket.id)
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
					<div className="flex items-center gap-2 text-zinc-500">
						<div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-600">
							<User className="h-3 w-3" />
						</div>
						<span className="truncate text-sm">Unassigned</span>
					</div>
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
				'group border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50 focus:bg-zinc-800/50 focus:outline-none select-none',
				isDragging && 'opacity-50 bg-zinc-800 shadow-lg',
				isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
				selected && 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50',
			)}
			{...(isDraggable ? attributes : {})}
			{...(isDraggable ? listeners : {})}
		>
			{/* Drag handle cell - always render to maintain table alignment */}
			<td className="w-8 px-1 py-2">
				{isDraggable && (
					<div className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
						<GripVertical className="h-4 w-4 text-zinc-500" />
					</div>
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
