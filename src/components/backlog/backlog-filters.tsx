'use client'

import { Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useBacklogStore } from '@/stores/backlog-store'
import type { ColumnWithTickets } from '@/types'
import { ISSUE_TYPES, PRIORITIES } from '@/types'

interface BacklogFiltersProps {
	statusColumns: ColumnWithTickets[]
}

export function BacklogFilters({ statusColumns: _statusColumns }: BacklogFiltersProps) {
	const {
		searchQuery,
		setSearchQuery,
		filterByType,
		setFilterByType,
		filterByPriority,
		setFilterByPriority,
		clearFilters,
	} = useBacklogStore()

	const hasActiveFilters =
		filterByType.length > 0 || filterByPriority.length > 0 || searchQuery.length > 0

	const toggleType = (type: string) => {
		if (filterByType.includes(type)) {
			setFilterByType(filterByType.filter((t) => t !== type))
		} else {
			setFilterByType([...filterByType, type])
		}
	}

	const togglePriority = (priority: string) => {
		if (filterByPriority.includes(priority)) {
			setFilterByPriority(filterByPriority.filter((p) => p !== priority))
		} else {
			setFilterByPriority([...filterByPriority, priority])
		}
	}

	return (
		<div className="flex flex-1 items-center gap-3">
			{/* Search */}
			<div className="relative max-w-xs flex-1">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
				<Input
					placeholder="Search tickets..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Type filter */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" className="shrink-0">
						Type
						{filterByType.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{filterByType.length}
							</Badge>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuLabel>Filter by type</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{ISSUE_TYPES.map((type) => (
						<DropdownMenuCheckboxItem
							key={type}
							checked={filterByType.includes(type)}
							onCheckedChange={() => toggleType(type)}
						>
							<span className="capitalize">{type}</span>
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Priority filter */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" className="shrink-0">
						Priority
						{filterByPriority.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{filterByPriority.length}
							</Badge>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{PRIORITIES.map((priority) => (
						<DropdownMenuCheckboxItem
							key={priority}
							checked={filterByPriority.includes(priority)}
							onCheckedChange={() => togglePriority(priority)}
						>
							<span className="capitalize">{priority}</span>
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Clear filters */}
			{hasActiveFilters && (
				<Button
					variant="ghost"
					size="sm"
					onClick={clearFilters}
					className="shrink-0 text-zinc-400 hover:text-zinc-200"
				>
					<X className="mr-1 h-4 w-4" />
					Clear
				</Button>
			)}
		</div>
	)
}
