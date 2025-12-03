'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, isToday } from 'date-fns'
import { Calendar, GripVertical, MessageSquare, Paperclip, User } from 'lucide-react'
import { PriorityBadge } from '@/components/common/priority-badge'
import { TypeBadge } from '@/components/common/type-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { IssueType, Priority, TicketWithRelations } from '@/types'

interface KanbanCardProps {
	ticket: TicketWithRelations
	projectKey: string
	allTicketIds?: string[]
}

export function KanbanCard({ ticket, projectKey, allTicketIds = [] }: KanbanCardProps) {
	const { setActiveTicketId } = useUIStore()
	const { isSelected, selectTicket, toggleTicket, selectRange } = useSelectionStore()
	const selected = isSelected(ticket.id)

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: ticket.id,
		data: {
			type: 'ticket',
			ticket,
		},
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	const handleClick = (e: React.MouseEvent) => {
		// Ctrl/Cmd + click: toggle selection
		if (e.ctrlKey || e.metaKey) {
			toggleTicket(ticket.id)
			return
		}

		// Shift + click: range selection
		if (e.shiftKey) {
			e.preventDefault()
			e.stopPropagation()
			selectRange(ticket.id, allTicketIds)
			return
		}

		// If this ticket is already selected and part of a multi-selection,
		// don't change selection (allows dragging the group)
		// Only open ticket detail if it's the only one selected
		if (selected && useSelectionStore.getState().selectedTicketIds.size > 1) {
			// Don't change selection, allow drag to proceed
			return
		}

		// Normal click: open ticket detail (and select only this one)
		selectTicket(ticket.id)
		setActiveTicketId(ticket.id)
	}

	const commentCount = ticket._count?.comments ?? 0
	const attachmentCount = ticket._count?.attachments ?? 0
	const isOverdue = ticket.dueDate && isPast(ticket.dueDate) && !isToday(ticket.dueDate)
	const isDueToday = ticket.dueDate && isToday(ticket.dueDate)

	return (
		<Card
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				'group relative cursor-grab border-zinc-800 bg-zinc-900/80 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors select-none active:cursor-grabbing',
				isDragging && 'opacity-50 shadow-lg ring-2 ring-amber-500/50',
				selected && 'ring-2 ring-amber-500 border-amber-500/50 bg-amber-500/10',
			)}
			onClick={handleClick}
		>
			{/* Drag handle indicator - visible on hover */}
			<div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
				<GripVertical className="h-4 w-4 text-zinc-600" />
			</div>

			<div className="pl-4">
				{/* Header row: Type, Key, Priority */}
				<div className="flex items-center gap-2 mb-2">
					<TypeBadge type={ticket.type as IssueType} size="sm" />
					<span className="text-xs font-mono text-zinc-500">
						{projectKey}-{ticket.number}
					</span>
					<div className="ml-auto">
						<PriorityBadge priority={ticket.priority as Priority} showLabel={false} size="sm" />
					</div>
				</div>

				{/* Title */}
				<h4 className="text-sm font-medium text-zinc-200 mb-2 line-clamp-2">{ticket.title}</h4>

				{/* Labels */}
				{ticket.labels.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-2">
						{ticket.labels.slice(0, 3).map((label) => (
							<Badge
								key={label.id}
								variant="outline"
								className="text-[10px] px-1.5 py-0"
								style={{
									borderColor: label.color,
									color: label.color,
									backgroundColor: `${label.color}20`,
								}}
							>
								{label.name}
							</Badge>
						))}
						{ticket.labels.length > 3 && (
							<Badge
								variant="outline"
								className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500"
							>
								+{ticket.labels.length - 3}
							</Badge>
						)}
					</div>
				)}

				{/* Due date if set */}
				{ticket.dueDate && (
					<div
						className={cn(
							'flex items-center gap-1 text-[10px] mb-2',
							isOverdue && 'text-red-400',
							isDueToday && 'text-amber-400',
							!isOverdue && !isDueToday && 'text-zinc-500',
						)}
					>
						<Calendar className="h-3 w-3" />
						<span>{format(ticket.dueDate, 'MMM d')}</span>
						{isOverdue && <span className="font-medium">(Overdue)</span>}
						{isDueToday && <span className="font-medium">(Today)</span>}
					</div>
				)}

				{/* Footer */}
				<div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
					{/* Assignee */}
					{ticket.assignee ? (
						<Avatar className="h-5 w-5" title={ticket.assignee.name}>
							<AvatarImage src={ticket.assignee.avatar || undefined} />
							<AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px]">
								{ticket.assignee.name.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					) : (
						<div
							className="h-5 w-5 rounded-full border border-dashed border-zinc-700 flex items-center justify-center"
							title="Unassigned"
						>
							<User className="h-2.5 w-2.5 text-zinc-600" />
						</div>
					)}

					{/* Story points */}
					{ticket.storyPoints && (
						<span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
							{ticket.storyPoints} SP
						</span>
					)}

					{/* Metadata counts */}
					<div className="flex items-center gap-2 text-zinc-600">
						{attachmentCount > 0 && (
							<div className="flex items-center gap-0.5" title={`${attachmentCount} attachment(s)`}>
								<Paperclip className="h-3 w-3" />
								<span className="text-[10px]">{attachmentCount}</span>
							</div>
						)}
						{commentCount > 0 && (
							<div className="flex items-center gap-0.5" title={`${commentCount} comment(s)`}>
								<MessageSquare className="h-3 w-3" />
								<span className="text-[10px]">{commentCount}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</Card>
	)
}
