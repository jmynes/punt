'use client'

import { List, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { BacklogTable, ColumnConfig } from '@/components/backlog'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { IssueType, Priority, TicketWithRelations } from '@/types'

// Initial demo tickets to populate the store
const INITIAL_DEMO_TICKETS: TicketWithRelations[] = [
	{
		id: 'ticket-1',
		number: 1,
		title: 'Set up project infrastructure',
		description: 'Initialize the project with Next.js, TypeScript, and Tailwind',
		type: 'task' as IssueType,
		priority: 'high' as Priority,
		order: 0,
		storyPoints: 5,
		estimate: '1d',
		startDate: null,
		dueDate: new Date('2024-12-15'),
		environment: null,
		affectedVersion: null,
		fixVersion: null,
		createdAt: new Date('2024-11-28'),
		updatedAt: new Date('2024-12-01'),
		projectId: '1',
		columnId: 'col-1',
		assigneeId: null,
		creatorId: 'user-1',
		sprintId: 'sprint-2',
		parentId: null,
		assignee: null,
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: { id: 'sprint-2', name: 'Sprint 2', isActive: true, startDate: null, endDate: null },
		labels: [{ id: 'label-1', name: 'infrastructure', color: '#10b981' }],
		watchers: [],
		_count: { comments: 0, subtasks: 0, attachments: 0 },
	},
	{
		id: 'ticket-2',
		number: 2,
		title: 'Design the database schema',
		description: 'Create Prisma schema for users, projects, tickets, and columns',
		type: 'task' as IssueType,
		priority: 'medium' as Priority,
		order: 1,
		storyPoints: 3,
		estimate: '4h',
		startDate: null,
		dueDate: null,
		environment: null,
		affectedVersion: null,
		fixVersion: null,
		createdAt: new Date('2024-11-29'),
		updatedAt: new Date('2024-12-02'),
		projectId: '1',
		columnId: 'col-1',
		assigneeId: 'user-1',
		creatorId: 'user-1',
		sprintId: null,
		parentId: null,
		assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: null,
		labels: [
			{ id: 'label-2', name: 'database', color: '#8b5cf6' },
			{ id: 'label-3', name: 'backend', color: '#f59e0b' },
		],
		watchers: [],
		_count: { comments: 2, subtasks: 0, attachments: 0 },
	},
	{
		id: 'ticket-3',
		number: 3,
		title: 'Implement authentication flow',
		description: 'Add login and registration with session management',
		type: 'story' as IssueType,
		priority: 'high' as Priority,
		order: 0,
		storyPoints: 8,
		estimate: '2d',
		startDate: null,
		dueDate: new Date('2024-12-20'),
		environment: null,
		affectedVersion: null,
		fixVersion: null,
		createdAt: new Date('2024-11-30'),
		updatedAt: new Date('2024-12-03'),
		projectId: '1',
		columnId: 'col-2',
		assigneeId: null,
		creatorId: 'user-1',
		sprintId: 'sprint-2',
		parentId: null,
		assignee: null,
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: { id: 'sprint-2', name: 'Sprint 2', isActive: true, startDate: null, endDate: null },
		labels: [{ id: 'label-4', name: 'auth', color: '#ef4444' }],
		watchers: [{ id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null }],
		_count: { comments: 0, subtasks: 3, attachments: 0 },
	},
	{
		id: 'ticket-4',
		number: 4,
		title: 'Build Kanban board components',
		description: 'Create draggable columns and cards with dnd-kit',
		type: 'task' as IssueType,
		priority: 'critical' as Priority,
		order: 0,
		storyPoints: 5,
		estimate: '1d',
		startDate: new Date(),
		dueDate: new Date('2024-12-10'),
		environment: 'Development',
		affectedVersion: null,
		fixVersion: 'v0.1.0',
		createdAt: new Date('2024-12-01'),
		updatedAt: new Date('2024-12-03'),
		projectId: '1',
		columnId: 'col-3',
		assigneeId: 'user-1',
		creatorId: 'user-1',
		sprintId: 'sprint-2',
		parentId: null,
		assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: { id: 'sprint-2', name: 'Sprint 2', isActive: true, startDate: null, endDate: null },
		labels: [
			{ id: 'label-5', name: 'frontend', color: '#06b6d4' },
			{ id: 'label-6', name: 'ui/ux', color: '#ec4899' },
		],
		watchers: [],
		_count: { comments: 5, subtasks: 0, attachments: 1 },
	},
	{
		id: 'ticket-5',
		number: 5,
		title: 'Initialize repository',
		description: 'Set up Git repository with proper .gitignore',
		type: 'task' as IssueType,
		priority: 'low' as Priority,
		order: 0,
		storyPoints: 1,
		estimate: '30m',
		startDate: new Date('2024-12-01'),
		dueDate: new Date('2024-12-01'),
		environment: null,
		affectedVersion: null,
		fixVersion: 'v0.1.0',
		createdAt: new Date('2024-11-25'),
		updatedAt: new Date('2024-12-01'),
		projectId: '1',
		columnId: 'col-5',
		assigneeId: 'user-1',
		creatorId: 'user-1',
		sprintId: 'sprint-1',
		parentId: null,
		assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: { id: 'sprint-1', name: 'Sprint 1', isActive: false, startDate: null, endDate: null },
		labels: [],
		watchers: [],
		_count: { comments: 0, subtasks: 0, attachments: 0 },
	},
	{
		id: 'ticket-6',
		number: 6,
		title: 'Fix login button not responding on mobile',
		description: 'The login button does not trigger on iOS Safari due to touch event handling',
		type: 'bug' as IssueType,
		priority: 'highest' as Priority,
		order: 1,
		storyPoints: 2,
		estimate: '2h',
		startDate: null,
		dueDate: null,
		environment: 'Production',
		affectedVersion: 'v0.0.9',
		fixVersion: 'v0.1.0',
		createdAt: new Date('2024-12-02'),
		updatedAt: new Date('2024-12-03'),
		projectId: '1',
		columnId: 'col-5',
		assigneeId: 'user-2',
		creatorId: 'user-3',
		sprintId: 'sprint-1',
		parentId: null,
		assignee: { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
		creator: { id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
		sprint: { id: 'sprint-1', name: 'Sprint 1', isActive: false, startDate: null, endDate: null },
		labels: [{ id: 'label-7', name: 'mobile', color: '#f97316' }],
		watchers: [],
		_count: { comments: 3, subtasks: 0, attachments: 2 },
	},
	{
		id: 'ticket-7',
		number: 7,
		title: 'User Management Epic',
		description:
			'Complete user management system including roles, permissions, and profile settings',
		type: 'epic' as IssueType,
		priority: 'high' as Priority,
		order: 2,
		storyPoints: 21,
		estimate: '2w',
		startDate: new Date('2024-12-01'),
		dueDate: new Date('2024-12-31'),
		environment: null,
		affectedVersion: null,
		fixVersion: 'v0.2.0',
		createdAt: new Date('2024-11-20'),
		updatedAt: new Date('2024-12-01'),
		projectId: '1',
		columnId: 'col-2',
		assigneeId: 'user-1',
		creatorId: 'user-1',
		sprintId: null,
		parentId: null,
		assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: null,
		labels: [{ id: 'label-8', name: 'epic', color: '#a855f7' }],
		watchers: [
			{ id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
			{ id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
		],
		_count: { comments: 1, subtasks: 5, attachments: 0 },
	},
	{
		id: 'ticket-8',
		number: 8,
		title: 'Add user profile page',
		description: 'Create a page where users can view and edit their profile',
		type: 'subtask' as IssueType,
		priority: 'medium' as Priority,
		order: 3,
		storyPoints: 3,
		estimate: '4h',
		startDate: null,
		dueDate: new Date('2024-12-18'),
		environment: null,
		affectedVersion: null,
		fixVersion: 'v0.2.0',
		createdAt: new Date('2024-12-01'),
		updatedAt: new Date('2024-12-02'),
		projectId: '1',
		columnId: 'col-1',
		assigneeId: 'user-2',
		creatorId: 'user-1',
		sprintId: 'sprint-2',
		parentId: 'ticket-7',
		assignee: { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
		creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
		sprint: { id: 'sprint-2', name: 'Sprint 2', isActive: true, startDate: null, endDate: null },
		labels: [],
		watchers: [],
		_count: { comments: 0, subtasks: 0, attachments: 0 },
	},
]

// Project key lookup
const projectKeys: Record<string, string> = {
	'1': 'PUNT',
	'2': 'API',
	'3': 'MOB',
}

export default function BacklogPage() {
	const params = useParams()
	const projectId = params.projectId as string
	const projectKey = projectKeys[projectId] || 'PROJ'

	const { columns, setColumns, _hasHydrated } = useBoardStore()
	const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
		useUIStore()
	const { clearSelection } = useSelectionStore()

	// Clear selection and active ticket when entering this page
	useEffect(() => {
		clearSelection()
		setActiveTicketId(null)
	}, [clearSelection, setActiveTicketId])

	// Initialize with demo data after hydration (only if columns are empty of tickets)
	useEffect(() => {
		if (!_hasHydrated) return // Wait for hydration
		
		const hasTickets = columns.some((col) => col.tickets.length > 0)
		if (!hasTickets) {
			// Populate columns with demo tickets
			const columnsWithTickets = columns.map((col) => ({
				...col,
				tickets: INITIAL_DEMO_TICKETS.filter((t) => t.columnId === col.id),
			}))
			setColumns(columnsWithTickets)
		}
	}, [_hasHydrated]) // Run when hydration completes

	// Set active project on mount
	useEffect(() => {
		setActiveProjectId(projectId)
	}, [projectId, setActiveProjectId])

	// Extract all tickets from columns (flattened for backlog view)
	const allTickets = useMemo(() => {
		return columns.flatMap((col) => col.tickets)
	}, [columns])

	// Find the selected ticket
	const selectedTicket = useMemo(
		() => allTickets.find((t) => t.id === activeTicketId) || null,
		[activeTicketId, allTickets],
	)

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			{/* Page header */}
			<div className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800">
						<List className="h-5 w-5 text-zinc-400" />
					</div>
					<div>
						<h1 className="text-xl font-semibold text-zinc-100">{projectKey} Backlog</h1>
						<p className="text-sm text-zinc-500">
							View and manage all tickets in a configurable list
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
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

			{/* Backlog table */}
			<div className="flex-1 overflow-hidden">
				<BacklogTable tickets={allTickets} columns={columns} projectKey={projectKey} />
			</div>

			{/* Column config sheet */}
			<ColumnConfig />

			{/* Ticket detail drawer */}
			<TicketDetailDrawer
				ticket={selectedTicket}
				projectKey={projectKey}
				onClose={() => setActiveTicketId(null)}
			/>
		</div>
	)
}
