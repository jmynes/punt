'use client'

import { format } from 'date-fns'
import {
	Calendar,
	Clock,
	Eye,
	Link2,
	MessageSquare,
	MoreHorizontal,
	Paperclip,
	Share2,
	User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import type { TicketWithRelations } from '@/types'
import { PriorityBadge } from '../common/priority-badge'
import { TypeBadge } from '../common/type-badge'

interface TicketDetailDrawerProps {
	ticket: TicketWithRelations | null
	projectKey: string
	onClose: () => void
}

export function TicketDetailDrawer({ ticket, projectKey, onClose }: TicketDetailDrawerProps) {
	if (!ticket) return null

	const ticketKey = `${projectKey}-${ticket.number}`
	const isOverdue =
		ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.columnId !== 'col-5'

	return (
		<Sheet open={!!ticket} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				side="right"
				className="w-full border-zinc-800 bg-zinc-950 p-0 sm:max-w-xl md:max-w-2xl"
			>
				<div className="flex h-full flex-col">
					{/* Header - pr-14 gives space for the close button */}
					<SheetHeader className="border-b border-zinc-800 px-6 pr-14 py-4">
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-center gap-3">
								<TypeBadge type={ticket.type} size="md" />
								<SheetTitle className="text-base font-mono text-zinc-400">{ticketKey}</SheetTitle>
							</div>
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<Share2 className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<Link2 className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<Eye className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</div>
						</div>
						<SheetDescription className="sr-only">Ticket details for {ticketKey}</SheetDescription>
					</SheetHeader>

					{/* Content */}
					<ScrollArea className="flex-1">
						<div className="space-y-6 p-6">
							{/* Title */}
							<div>
								<h2 className="text-xl font-semibold text-zinc-100">{ticket.title}</h2>
							</div>

							{/* Meta row */}
							<div className="flex flex-wrap items-center gap-4 text-sm">
								<PriorityBadge priority={ticket.priority} showLabel />

								{ticket.sprint && (
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
								)}

								{ticket.storyPoints !== null && (
									<Badge variant="outline" className="font-mono">
										{ticket.storyPoints} pts
									</Badge>
								)}

								{ticket.estimate && (
									<span className="flex items-center gap-1 text-zinc-400">
										<Clock className="h-3.5 w-3.5" />
										{ticket.estimate}
									</span>
								)}
							</div>

							{/* Description */}
							<div className="space-y-2">
								<Label className="text-zinc-400">Description</Label>
								{ticket.description ? (
									<div className="rounded-md bg-zinc-900/50 p-4 text-sm text-zinc-300 whitespace-pre-wrap">
										{ticket.description}
									</div>
								) : (
									<p className="text-sm text-zinc-500 italic">No description provided</p>
								)}
							</div>

							<Separator className="bg-zinc-800" />

							{/* Details grid */}
							<div className="grid grid-cols-2 gap-4">
								{/* Assignee */}
								<div className="space-y-2">
									<Label className="text-zinc-400">Assignee</Label>
									{ticket.assignee ? (
										<div className="flex items-center gap-2">
											<Avatar className="h-6 w-6">
												<AvatarImage src={ticket.assignee.avatar || undefined} />
												<AvatarFallback className="text-xs">
													{ticket.assignee.name
														.split(' ')
														.map((n) => n[0])
														.join('')
														.toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm text-zinc-200">{ticket.assignee.name}</span>
										</div>
									) : (
										<span className="text-sm text-zinc-500">Unassigned</span>
									)}
								</div>

								{/* Reporter */}
								<div className="space-y-2">
									<Label className="text-zinc-400">Reporter</Label>
									<div className="flex items-center gap-2">
										<Avatar className="h-6 w-6">
											<AvatarImage src={ticket.creator.avatar || undefined} />
											<AvatarFallback className="text-xs">
												{ticket.creator.name
													.split(' ')
													.map((n) => n[0])
													.join('')
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="text-sm text-zinc-200">{ticket.creator.name}</span>
									</div>
								</div>

								{/* Due Date */}
								<div className="space-y-2">
									<Label className="text-zinc-400">Due Date</Label>
									{ticket.dueDate ? (
										<span
											className={cn(
												'text-sm',
												isOverdue ? 'text-red-400 font-medium' : 'text-zinc-200',
											)}
										>
											{format(ticket.dueDate, 'MMM d, yyyy')}
										</span>
									) : (
										<span className="text-sm text-zinc-500">Not set</span>
									)}
								</div>

								{/* Start Date */}
								<div className="space-y-2">
									<Label className="text-zinc-400">Start Date</Label>
									{ticket.startDate ? (
										<span className="text-sm text-zinc-200">
											{format(ticket.startDate, 'MMM d, yyyy')}
										</span>
									) : (
										<span className="text-sm text-zinc-500">Not set</span>
									)}
								</div>

								{/* Environment */}
								{ticket.environment && (
									<div className="space-y-2">
										<Label className="text-zinc-400">Environment</Label>
										<span className="text-sm text-zinc-200">{ticket.environment}</span>
									</div>
								)}

								{/* Affected Version */}
								{ticket.affectedVersion && (
									<div className="space-y-2">
										<Label className="text-zinc-400">Affected Version</Label>
										<span className="text-sm text-zinc-200">{ticket.affectedVersion}</span>
									</div>
								)}

								{/* Fix Version */}
								{ticket.fixVersion && (
									<div className="space-y-2">
										<Label className="text-zinc-400">Fix Version</Label>
										<span className="text-sm text-zinc-200">{ticket.fixVersion}</span>
									</div>
								)}
							</div>

							{/* Labels */}
							{ticket.labels.length > 0 && (
								<div className="space-y-2">
									<Label className="text-zinc-400">Labels</Label>
									<div className="flex flex-wrap gap-1">
										{ticket.labels.map((label) => (
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
									</div>
								</div>
							)}

							{/* Watchers */}
							{ticket.watchers.length > 0 && (
								<div className="space-y-2">
									<Label className="text-zinc-400">Watchers</Label>
									<div className="flex -space-x-2">
										{ticket.watchers.map((watcher) => (
											<Avatar key={watcher.id} className="h-7 w-7 border-2 border-zinc-900">
												<AvatarImage src={watcher.avatar || undefined} />
												<AvatarFallback className="text-xs">
													{watcher.name
														.split(' ')
														.map((n) => n[0])
														.join('')
														.toUpperCase()}
												</AvatarFallback>
											</Avatar>
										))}
									</div>
								</div>
							)}

							<Separator className="bg-zinc-800" />

							{/* Activity section */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<Label className="text-zinc-400">Activity</Label>
									<div className="flex items-center gap-4 text-xs text-zinc-500">
										{ticket._count && (
											<>
												<span className="flex items-center gap-1">
													<MessageSquare className="h-3.5 w-3.5" />
													{ticket._count.comments} comments
												</span>
												<span className="flex items-center gap-1">
													<Paperclip className="h-3.5 w-3.5" />
													{ticket._count.attachments} attachments
												</span>
											</>
										)}
									</div>
								</div>

								{/* Comment input */}
								<div className="space-y-2">
									<Textarea
										placeholder="Add a comment..."
										rows={3}
										className="resize-none bg-zinc-900 border-zinc-700 focus:border-amber-500"
									/>
									<div className="flex justify-end">
										<Button size="sm" className="bg-amber-600 hover:bg-amber-700">
											Comment
										</Button>
									</div>
								</div>
							</div>

							{/* Timestamps */}
							<div className="pt-4 border-t border-zinc-800 text-xs text-zinc-500 space-y-1">
								<p>Created {format(ticket.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
								<p>Updated {format(ticket.updatedAt, "MMM d, yyyy 'at' h:mm a")}</p>
							</div>
						</div>
					</ScrollArea>

					{/* Footer actions */}
					<div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
						<Button variant="outline" size="sm">
							Edit
						</Button>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm">
								Clone
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="text-red-400 hover:text-red-300 hover:bg-red-900/20 hover:border-red-800"
							>
								Delete
							</Button>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
