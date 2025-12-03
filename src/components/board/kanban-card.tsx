'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MessageSquare, User } from 'lucide-react'
import { PriorityBadge } from '@/components/common/priority-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { Priority, TicketWithRelations } from '@/types'

interface KanbanCardProps {
	ticket: TicketWithRelations
	projectKey: string
}

export function KanbanCard({ ticket, projectKey }: KanbanCardProps) {
	const { setActiveTicketId } = useUIStore()

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

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={cn(
				'group relative cursor-pointer border-zinc-800 bg-zinc-900/80 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors',
				isDragging && 'opacity-50 shadow-lg ring-2 ring-amber-500/50',
			)}
			onClick={() => setActiveTicketId(ticket.id)}
		>
			{/* Drag handle */}
			<div
				{...attributes}
				{...listeners}
				className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
			>
				<GripVertical className="h-4 w-4 text-zinc-600" />
			</div>

			<div className="pl-4">
				{/* Ticket key */}
				<div className="flex items-center gap-2 mb-2">
					<span className="text-xs font-mono text-zinc-500">
						{projectKey}-{ticket.number}
					</span>
					<PriorityBadge priority={ticket.priority as Priority} showLabel={false} size="sm" />
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

				{/* Footer */}
				<div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
					{/* Assignee */}
					{ticket.assignee ? (
						<Avatar className="h-5 w-5">
							<AvatarImage src={ticket.assignee.avatar || undefined} />
							<AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px]">
								{ticket.assignee.name.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					) : (
						<div className="h-5 w-5 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
							<User className="h-2.5 w-2.5 text-zinc-600" />
						</div>
					)}

					{/* Comment count placeholder */}
					<div className="flex items-center gap-1 text-zinc-600">
						<MessageSquare className="h-3 w-3" />
						<span className="text-[10px]">0</span>
					</div>
				</div>
			</div>
		</Card>
	)
}
