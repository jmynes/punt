'use client'

import { Check, ChevronsUpDown, User, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import type { UserSummary } from '@/types'

interface UserSelectProps {
	value: string | null
	onChange: (value: string | null) => void
	users: UserSummary[]
	currentUserId: string
	placeholder?: string
	disabled?: boolean
	showAssignToMe?: boolean
}

export function UserSelect({
	value,
	onChange,
	users,
	currentUserId,
	placeholder = 'Select user...',
	disabled,
	showAssignToMe = true,
}: UserSelectProps) {
	const [open, setOpen] = useState(false)
	const selectedUser = users.find((u) => u.id === value)
	const isAssignedToMe = value === currentUserId

	return (
		<div className="flex gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className="flex-1 justify-between bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
					>
						{selectedUser ? (
							<div className="flex items-center gap-2">
								<Avatar className="h-5 w-5">
									<AvatarImage src={selectedUser.avatar || undefined} />
									<AvatarFallback className="bg-zinc-700 text-xs">
										{selectedUser.name.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="truncate">{selectedUser.name}</span>
							</div>
						) : (
							<span className="text-zinc-500">{placeholder}</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-0 bg-zinc-900 border-zinc-700">
					<Command className="bg-transparent">
						<CommandInput placeholder="Search users..." className="border-zinc-700" />
						<CommandList>
							<CommandEmpty>No users found.</CommandEmpty>
							<CommandGroup>
								{/* Unassigned option */}
								<CommandItem
									value="unassigned"
									onSelect={() => {
										onChange(null)
										setOpen(false)
									}}
									className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
								>
									<User className="mr-2 h-4 w-4 text-zinc-500" />
									<span className="text-zinc-400">Unassigned</span>
									<Check
										className={cn('ml-auto h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')}
									/>
								</CommandItem>
								{/* User options */}
								{users.map((user) => (
									<CommandItem
										key={user.id}
										value={user.name}
										onSelect={() => {
											onChange(user.id)
											setOpen(false)
										}}
										className="cursor-pointer data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
									>
										<Avatar className="mr-2 h-5 w-5">
											<AvatarImage src={user.avatar || undefined} />
											<AvatarFallback className="bg-zinc-700 text-xs">
												{user.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span>{user.name}</span>
										{user.id === currentUserId && (
											<span className="ml-1 text-xs text-zinc-500">(you)</span>
										)}
										<Check
											className={cn(
												'ml-auto h-4 w-4',
												value === user.id ? 'opacity-100' : 'opacity-0',
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* Assign to me / Unassign button */}
			{showAssignToMe && (
				<Button
					type="button"
					variant="outline"
					size="icon"
					disabled={disabled}
					className={cn(
						'shrink-0 border-zinc-700',
						isAssignedToMe
							? 'bg-amber-600/20 border-amber-600/50 hover:bg-amber-600/30 text-amber-400'
							: 'bg-zinc-900 hover:bg-zinc-800',
					)}
					onClick={() => onChange(isAssignedToMe ? null : currentUserId)}
					title={isAssignedToMe ? 'Unassign from me' : 'Assign to me'}
				>
					{isAssignedToMe ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
				</Button>
			)}
		</div>
	)
}
