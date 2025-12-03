'use client'

import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { KanbanBoard } from '@/components/board'
import { Button } from '@/components/ui/button'
import { useBoardStore } from '@/stores/board-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, Priority } from '@/types'

// Demo data for the board
const demoColumns: ColumnWithTickets[] = [
	{
		id: 'col-1',
		name: 'Backlog',
		order: 0,
		projectId: '1',
		tickets: [
			{
				id: 'ticket-1',
				number: 1,
				title: 'Set up project infrastructure',
				description: 'Initialize the project with Next.js, TypeScript, and Tailwind',
				priority: 'high' as Priority,
				order: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				projectId: '1',
				columnId: 'col-1',
				assigneeId: null,
				creatorId: 'user-1',
				assignee: null,
				creator: { id: 'user-1', name: 'Demo User', avatar: null },
				labels: [{ id: 'label-1', name: 'setup', color: '#10b981' }],
			},
			{
				id: 'ticket-2',
				number: 2,
				title: 'Design the database schema',
				description: 'Create Prisma schema for users, projects, tickets, and columns',
				priority: 'medium' as Priority,
				order: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
				projectId: '1',
				columnId: 'col-1',
				assigneeId: 'user-1',
				creatorId: 'user-1',
				assignee: { id: 'user-1', name: 'Demo User', avatar: null },
				creator: { id: 'user-1', name: 'Demo User', avatar: null },
				labels: [
					{ id: 'label-2', name: 'database', color: '#8b5cf6' },
					{ id: 'label-3', name: 'backend', color: '#f59e0b' },
				],
			},
		],
	},
	{
		id: 'col-2',
		name: 'To Do',
		order: 1,
		projectId: '1',
		tickets: [
			{
				id: 'ticket-3',
				number: 3,
				title: 'Implement authentication flow',
				description: 'Add login and registration with session management',
				priority: 'high' as Priority,
				order: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				projectId: '1',
				columnId: 'col-2',
				assigneeId: null,
				creatorId: 'user-1',
				assignee: null,
				creator: { id: 'user-1', name: 'Demo User', avatar: null },
				labels: [{ id: 'label-4', name: 'auth', color: '#ef4444' }],
			},
		],
	},
	{
		id: 'col-3',
		name: 'In Progress',
		order: 2,
		projectId: '1',
		tickets: [
			{
				id: 'ticket-4',
				number: 4,
				title: 'Build Kanban board components',
				description: 'Create draggable columns and cards with dnd-kit',
				priority: 'critical' as Priority,
				order: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				projectId: '1',
				columnId: 'col-3',
				assigneeId: 'user-1',
				creatorId: 'user-1',
				assignee: { id: 'user-1', name: 'Demo User', avatar: null },
				creator: { id: 'user-1', name: 'Demo User', avatar: null },
				labels: [
					{ id: 'label-5', name: 'frontend', color: '#06b6d4' },
					{ id: 'label-6', name: 'ui', color: '#ec4899' },
				],
			},
		],
	},
	{
		id: 'col-4',
		name: 'Review',
		order: 3,
		projectId: '1',
		tickets: [],
	},
	{
		id: 'col-5',
		name: 'Done',
		order: 4,
		projectId: '1',
		tickets: [
			{
				id: 'ticket-5',
				number: 5,
				title: 'Initialize repository',
				description: 'Set up Git repository with proper .gitignore',
				priority: 'low' as Priority,
				order: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
				projectId: '1',
				columnId: 'col-5',
				assigneeId: 'user-1',
				creatorId: 'user-1',
				assignee: { id: 'user-1', name: 'Demo User', avatar: null },
				creator: { id: 'user-1', name: 'Demo User', avatar: null },
				labels: [],
			},
		],
	},
]

// Project key lookup
const projectKeys: Record<string, string> = {
	'1': 'PUNT',
	'2': 'API',
	'3': 'MOB',
}

export default function BoardPage() {
	const params = useParams()
	const projectId = params.projectId as string
	const projectKey = projectKeys[projectId] || 'PROJ'

	const { setColumns } = useBoardStore()
	const { setCreateTicketOpen, setActiveProjectId } = useUIStore()

	// Load demo data on mount
	useEffect(() => {
		setColumns(demoColumns)
		setActiveProjectId(projectId)
	}, [projectId, setColumns, setActiveProjectId])

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			{/* Board header */}
			<div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
				<div>
					<h1 className="text-xl font-semibold text-zinc-100">{projectKey} Board</h1>
					<p className="text-sm text-zinc-500">Drag and drop tickets to update their status</p>
				</div>

				<div className="flex items-center gap-2">
					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
						<input
							type="search"
							placeholder="Filter tickets..."
							className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 lg:w-64"
						/>
					</div>

					{/* Filter buttons */}
					<Button
						variant="outline"
						size="sm"
						className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					>
						<Filter className="h-4 w-4 mr-2" />
						Filter
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
					>
						<SlidersHorizontal className="h-4 w-4 mr-2" />
						View
					</Button>

					{/* Create ticket */}
					<Button
						size="sm"
						className="bg-amber-600 hover:bg-amber-700 text-white"
						onClick={() => setCreateTicketOpen(true)}
					>
						<Plus className="h-4 w-4 mr-1" />
						<span className="hidden sm:inline">New Ticket</span>
					</Button>
				</div>
			</div>

			{/* Board content */}
			<div className="flex-1 overflow-x-auto p-4 lg:p-6">
				<KanbanBoard projectKey={projectKey} />
			</div>
		</div>
	)
}
