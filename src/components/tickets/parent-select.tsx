'use client'

import { Check, ChevronsUpDown, Lightbulb, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ParentTicketOption } from './create-ticket-dialog'

interface ParentSelectProps {
	value: string | null
	onChange: (value: string | null) => void
	parentTickets: ParentTicketOption[]
	disabled?: boolean
}

export function ParentSelect({ value, onChange, parentTickets, disabled }: ParentSelectProps) {
	const [open, setOpen] = useState(false)
	const selectedParent = parentTickets.find((t) => t.id === value)

	// Group by type
	const epics = parentTickets.filter((t) => t.type === 'epic')
	const stories = parentTickets.filter((t) => t.type === 'story')

	return (
		<div className="flex gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className="flex-1 justify-between"
					>
						{selectedParent ? (
							<div className="flex items-center gap-2 truncate">
								{selectedParent.type === 'epic' ? (
									<Zap className="h-4 w-4 text-purple-400 shrink-0" />
								) : (
									<Lightbulb className="h-4 w-4 text-green-400 shrink-0" />
								)}
								<span className="font-mono text-zinc-500 shrink-0">
									{selectedParent.projectKey}-{selectedParent.number}
								</span>
								<span className="truncate">{selectedParent.title}</span>
							</div>
						) : (
							<span className="text-zinc-500">No parent (standalone ticket)</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-96 p-0 bg-zinc-900 border-zinc-700">
					<Command className="bg-transparent">
						<CommandInput placeholder="Search epics and stories..." className="border-zinc-700" />
						<CommandList>
							<CommandEmpty>No epics or stories found.</CommandEmpty>

							{/* No parent option */}
							<CommandGroup>
								<CommandItem
									value="none"
									onSelect={() => {
										onChange(null)
										setOpen(false)
									}}
									className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
								>
									<span className="text-zinc-400">No parent (standalone ticket)</span>
									<Check
										className={cn('ml-auto h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')}
									/>
								</CommandItem>
							</CommandGroup>

							{/* Epics */}
							{epics.length > 0 && (
								<CommandGroup heading="Epics">
									{epics.map((ticket) => (
										<CommandItem
											key={ticket.id}
											value={`${ticket.projectKey}-${ticket.number} ${ticket.title}`}
											onSelect={() => {
												onChange(ticket.id)
												setOpen(false)
											}}
											className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
										>
											<Zap className="mr-2 h-4 w-4 text-purple-400" />
											<span className="font-mono text-zinc-500 mr-2">
												{ticket.projectKey}-{ticket.number}
											</span>
											<span className="truncate">{ticket.title}</span>
											<Check
												className={cn(
													'ml-auto h-4 w-4',
													value === ticket.id ? 'opacity-100' : 'opacity-0',
												)}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							)}

							{/* Stories */}
							{stories.length > 0 && (
								<CommandGroup heading="Stories">
									{stories.map((ticket) => (
										<CommandItem
											key={ticket.id}
											value={`${ticket.projectKey}-${ticket.number} ${ticket.title}`}
											onSelect={() => {
												onChange(ticket.id)
												setOpen(false)
											}}
											className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
										>
											<Lightbulb className="mr-2 h-4 w-4 text-green-400" />
											<span className="font-mono text-zinc-500 mr-2">
												{ticket.projectKey}-{ticket.number}
											</span>
											<span className="truncate">{ticket.title}</span>
											<Check
												className={cn(
													'ml-auto h-4 w-4',
													value === ticket.id ? 'opacity-100' : 'opacity-0',
												)}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* Clear button */}
			{value && (
				<Button
					type="button"
					variant="outline"
					size="icon"
					disabled={disabled}
					className="shrink-0 border-zinc-700 bg-zinc-900 hover:bg-red-900/50 hover:text-red-400 hover:border-red-800"
					onClick={() => onChange(null)}
					title="Remove parent"
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</div>
	)
}
