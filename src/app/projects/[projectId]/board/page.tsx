'use client'

import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { KanbanBoard } from '@/components/board'
import { TicketDetailDrawer } from '@/components/tickets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBoardStore } from '@/stores/board-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useUIStore } from '@/stores/ui-store'
import type { ColumnWithTickets, IssueType, Priority } from '@/types'

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
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: '1',
        columnId: 'col-1',
        assigneeId: null,
        creatorId: 'user-1',
        sprintId: 'sprint-2',
        parentId: null,
        assignee: null,
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: {
          id: 'sprint-2',
          name: 'Sprint 2',
          isActive: true,
          startDate: null,
          endDate: null,
        },
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: '1',
        columnId: 'col-2',
        assigneeId: null,
        creatorId: 'user-1',
        sprintId: 'sprint-2',
        parentId: null,
        assignee: null,
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: {
          id: 'sprint-2',
          name: 'Sprint 2',
          isActive: true,
          startDate: null,
          endDate: null,
        },
        labels: [{ id: 'label-4', name: 'auth', color: '#ef4444' }],
        watchers: [{ id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null }],
        _count: { comments: 0, subtasks: 3, attachments: 0 },
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
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: '1',
        columnId: 'col-3',
        assigneeId: 'user-1',
        creatorId: 'user-1',
        sprintId: 'sprint-2',
        parentId: null,
        assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: {
          id: 'sprint-2',
          name: 'Sprint 2',
          isActive: true,
          startDate: null,
          endDate: null,
        },
        labels: [
          { id: 'label-5', name: 'frontend', color: '#06b6d4' },
          { id: 'label-6', name: 'ui/ux', color: '#ec4899' },
        ],
        watchers: [],
        _count: { comments: 5, subtasks: 0, attachments: 1 },
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
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: '1',
        columnId: 'col-5',
        assigneeId: 'user-1',
        creatorId: 'user-1',
        sprintId: 'sprint-1',
        parentId: null,
        assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: {
          id: 'sprint-1',
          name: 'Sprint 1',
          isActive: false,
          startDate: null,
          endDate: null,
        },
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
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: '1',
        columnId: 'col-5',
        assigneeId: 'user-2',
        creatorId: 'user-3',
        sprintId: 'sprint-1',
        parentId: null,
        assignee: { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
        creator: { id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
        sprint: {
          id: 'sprint-1',
          name: 'Sprint 1',
          isActive: false,
          startDate: null,
          endDate: null,
        },
        labels: [{ id: 'label-7', name: 'mobile', color: '#f97316' }],
        watchers: [],
        _count: { comments: 3, subtasks: 0, attachments: 2 },
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

  const { columns, setColumns, searchQuery, setSearchQuery, _hasHydrated } = useBoardStore()
  const { setCreateTicketOpen, setActiveProjectId, activeTicketId, setActiveTicketId } =
    useUIStore()
  const { clearSelection } = useSelectionStore()

  // Clear selection and active ticket when entering this page
  useEffect(() => {
    clearSelection()
    setActiveTicketId(null)
  }, [clearSelection, setActiveTicketId])

  // Get all tickets for finding the selected one
  const allTickets = useMemo(() => columns.flatMap((col) => col.tickets), [columns])
  const selectedTicket = useMemo(
    () => allTickets.find((t) => t.id === activeTicketId) || null,
    [activeTicketId, allTickets],
  )

  // Load demo data after hydration (only if columns are empty of tickets)
  useEffect(() => {
    if (!_hasHydrated) return // Wait for hydration

    const hasTickets = columns.some((col) => col.tickets.length > 0)
    if (!hasTickets) {
      setColumns(demoColumns)
    }
    setActiveProjectId(projectId)
  }, [_hasHydrated, columns.some, projectId, setActiveProjectId, setColumns]) // Run when hydration completes

  // Clear search when leaving page
  useEffect(() => {
    return () => setSearchQuery('')
  }, [setSearchQuery])

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
          <div className="relative lg:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder="Filter tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter buttons */}
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-amber-500/15 hover:border-zinc-600"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-amber-500/15 hover:border-zinc-600"
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
      <div className="flex-1 min-h-0 overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          <KanbanBoard projectKey={projectKey} />
        </div>
      </div>

      {/* Ticket detail drawer */}
      <TicketDetailDrawer
        ticket={selectedTicket}
        projectKey={projectKey}
        onClose={() => setActiveTicketId(null)}
      />
    </div>
  )
}
