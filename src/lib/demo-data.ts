import type { ColumnWithTickets, IssueType, Priority } from '@/types'

// Helper to create demo columns for a project
export function createDemoColumns(projectId: string, projectKey: string): ColumnWithTickets[] {
  const baseColumns = [
    { name: 'Backlog', order: 0 },
    { name: 'To Do', order: 1 },
    { name: 'In Progress', order: 2 },
    { name: 'Review', order: 3 },
    { name: 'Done', order: 4 },
  ]

  return baseColumns.map((col, idx) => ({
    id: `${projectId}-col-${idx + 1}`,
    name: col.name,
    order: col.order,
    projectId,
    tickets: [],
  }))
}

// Demo tickets for PUNT (projectId: '1')
export function createPUNTDemoTickets(): Array<{
  columnId: string
  ticket: {
    id: string
    number: number
    title: string
    description: string
    type: IssueType
    priority: Priority
    order: number
    storyPoints: number
    estimate: string
    startDate: Date | null
    dueDate: Date | null
    environment: string | null
    affectedVersion: string | null
    fixVersion: string | null
    createdAt: Date
    updatedAt: Date
    projectId: string
    columnId: string
    assigneeId: string | null
    creatorId: string
    sprintId: string | null
    parentId: string | null
    assignee: { id: string; name: string; email: string; avatar: string | null } | null
    creator: { id: string; name: string; email: string; avatar: string | null }
    sprint: {
      id: string
      name: string
      isActive: boolean
      startDate: Date | null
      endDate: Date | null
    } | null
    labels: Array<{ id: string; name: string; color: string }>
    watchers: Array<{ id: string; name: string; email: string; avatar: string | null }>
    _count: { comments: number; subtasks: number; attachments: number }
  }
}> {
  const projectId = '1'
  return [
    {
      columnId: `${projectId}-col-1`,
      ticket: {
        id: 'punt-ticket-1',
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
        projectId,
        columnId: `${projectId}-col-1`,
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
    },
    {
      columnId: `${projectId}-col-1`,
      ticket: {
        id: 'punt-ticket-2',
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
        projectId,
        columnId: `${projectId}-col-1`,
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
    },
    {
      columnId: `${projectId}-col-2`,
      ticket: {
        id: 'punt-ticket-3',
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
        projectId,
        columnId: `${projectId}-col-2`,
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
    },
    {
      columnId: `${projectId}-col-3`,
      ticket: {
        id: 'punt-ticket-4',
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
        projectId,
        columnId: `${projectId}-col-3`,
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
    },
    {
      columnId: `${projectId}-col-5`,
      ticket: {
        id: 'punt-ticket-5',
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
        projectId,
        columnId: `${projectId}-col-5`,
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
    },
    {
      columnId: `${projectId}-col-5`,
      ticket: {
        id: 'punt-ticket-6',
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
        projectId,
        columnId: `${projectId}-col-5`,
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
    },
  ]
}

// Demo tickets for API (projectId: '2')
export function createAPIDemoTickets(): Array<{
  columnId: string
  ticket: {
    id: string
    number: number
    title: string
    description: string
    type: IssueType
    priority: Priority
    order: number
    storyPoints: number
    estimate: string
    startDate: Date | null
    dueDate: Date | null
    environment: string | null
    affectedVersion: string | null
    fixVersion: string | null
    createdAt: Date
    updatedAt: Date
    projectId: string
    columnId: string
    assigneeId: string | null
    creatorId: string
    sprintId: string | null
    parentId: string | null
    assignee: { id: string; name: string; email: string; avatar: string | null } | null
    creator: { id: string; name: string; email: string; avatar: string | null }
    sprint: {
      id: string
      name: string
      isActive: boolean
      startDate: Date | null
      endDate: Date | null
    } | null
    labels: Array<{ id: string; name: string; color: string }>
    watchers: Array<{ id: string; name: string; email: string; avatar: string | null }>
    _count: { comments: number; subtasks: number; attachments: number }
  }
}> {
  const projectId = '2'
  return [
    {
      columnId: `${projectId}-col-1`,
      ticket: {
        id: 'api-ticket-1',
        number: 1,
        title: 'Design REST API endpoints',
        description: 'Define API structure for ticket management endpoints',
        type: 'task' as IssueType,
        priority: 'high' as Priority,
        order: 0,
        storyPoints: 5,
        estimate: '1d',
        startDate: null,
        dueDate: new Date('2024-12-20'),
        environment: null,
        affectedVersion: null,
        fixVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-1`,
        assigneeId: null,
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: null,
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [{ id: 'label-api-1', name: 'api', color: '#3b82f6' }],
        watchers: [],
        _count: { comments: 0, subtasks: 0, attachments: 0 },
      },
    },
    {
      columnId: `${projectId}-col-2`,
      ticket: {
        id: 'api-ticket-2',
        number: 2,
        title: 'Implement authentication middleware',
        description: 'Add JWT token validation for API requests',
        type: 'story' as IssueType,
        priority: 'high' as Priority,
        order: 0,
        storyPoints: 8,
        estimate: '2d',
        startDate: null,
        dueDate: null,
        environment: null,
        affectedVersion: null,
        fixVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-2`,
        assigneeId: 'user-1',
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [
          { id: 'label-api-2', name: 'auth', color: '#ef4444' },
          { id: 'label-api-3', name: 'security', color: '#f59e0b' },
        ],
        watchers: [],
        _count: { comments: 1, subtasks: 0, attachments: 0 },
      },
    },
    {
      columnId: `${projectId}-col-5`,
      ticket: {
        id: 'api-ticket-3',
        number: 3,
        title: 'Set up API documentation',
        description: 'Create OpenAPI/Swagger documentation for all endpoints',
        type: 'task' as IssueType,
        priority: 'medium' as Priority,
        order: 0,
        storyPoints: 3,
        estimate: '4h',
        startDate: new Date('2024-12-01'),
        dueDate: new Date('2024-12-01'),
        environment: null,
        affectedVersion: null,
        fixVersion: 'v1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-5`,
        assigneeId: 'user-2',
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [{ id: 'label-api-4', name: 'documentation', color: '#10b981' }],
        watchers: [],
        _count: { comments: 0, subtasks: 0, attachments: 0 },
      },
    },
  ]
}

// Demo tickets for MOB (projectId: '3')
export function createMOBDemoTickets(): Array<{
  columnId: string
  ticket: {
    id: string
    number: number
    title: string
    description: string
    type: IssueType
    priority: Priority
    order: number
    storyPoints: number
    estimate: string
    startDate: Date | null
    dueDate: Date | null
    environment: string | null
    affectedVersion: string | null
    fixVersion: string | null
    createdAt: Date
    updatedAt: Date
    projectId: string
    columnId: string
    assigneeId: string | null
    creatorId: string
    sprintId: string | null
    parentId: string | null
    assignee: { id: string; name: string; email: string; avatar: string | null } | null
    creator: { id: string; name: string; email: string; avatar: string | null }
    sprint: {
      id: string
      name: string
      isActive: boolean
      startDate: Date | null
      endDate: Date | null
    } | null
    labels: Array<{ id: string; name: string; color: string }>
    watchers: Array<{ id: string; name: string; email: string; avatar: string | null }>
    _count: { comments: number; subtasks: number; attachments: number }
  }
}> {
  const projectId = '3'
  return [
    {
      columnId: `${projectId}-col-1`,
      ticket: {
        id: 'mob-ticket-1',
        number: 1,
        title: 'Design mobile app UI/UX',
        description: 'Create wireframes and design mockups for mobile application',
        type: 'story' as IssueType,
        priority: 'high' as Priority,
        order: 0,
        storyPoints: 13,
        estimate: '3d',
        startDate: null,
        dueDate: new Date('2024-12-25'),
        environment: null,
        affectedVersion: null,
        fixVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-1`,
        assigneeId: null,
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: null,
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [
          { id: 'label-mob-1', name: 'mobile', color: '#f97316' },
          { id: 'label-mob-2', name: 'ui/ux', color: '#ec4899' },
        ],
        watchers: [],
        _count: { comments: 2, subtasks: 0, attachments: 0 },
      },
    },
    {
      columnId: `${projectId}-col-2`,
      ticket: {
        id: 'mob-ticket-2',
        number: 2,
        title: 'Implement navigation structure',
        description: 'Set up React Navigation with tab and stack navigators',
        type: 'task' as IssueType,
        priority: 'high' as Priority,
        order: 0,
        storyPoints: 5,
        estimate: '1d',
        startDate: null,
        dueDate: null,
        environment: null,
        affectedVersion: null,
        fixVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-2`,
        assigneeId: 'user-2',
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [{ id: 'label-mob-3', name: 'navigation', color: '#06b6d4' }],
        watchers: [],
        _count: { comments: 0, subtasks: 0, attachments: 0 },
      },
    },
    {
      columnId: `${projectId}-col-3`,
      ticket: {
        id: 'mob-ticket-3',
        number: 3,
        title: 'Build ticket list screen',
        description: 'Create the main screen showing all tickets with filters',
        type: 'task' as IssueType,
        priority: 'critical' as Priority,
        order: 0,
        storyPoints: 8,
        estimate: '2d',
        startDate: new Date(),
        dueDate: new Date('2024-12-15'),
        environment: 'Development',
        affectedVersion: null,
        fixVersion: 'v0.1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId,
        columnId: `${projectId}-col-3`,
        assigneeId: 'user-1',
        creatorId: 'user-1',
        sprintId: null,
        parentId: null,
        assignee: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        creator: { id: 'user-1', name: 'Demo User', email: 'demo@punt.local', avatar: null },
        sprint: null,
        labels: [
          { id: 'label-mob-4', name: 'frontend', color: '#06b6d4' },
          { id: 'label-mob-5', name: 'screens', color: '#8b5cf6' },
        ],
        watchers: [],
        _count: { comments: 3, subtasks: 0, attachments: 1 },
      },
    },
  ]
}

// Helper to get demo data for a project
export function getDemoData(projectId: string): ColumnWithTickets[] {
  const columns = createDemoColumns(projectId, '')
  let demoTickets: Array<{ columnId: string; ticket: any }> = []

  if (projectId === '1') {
    demoTickets = createPUNTDemoTickets()
  } else if (projectId === '2') {
    demoTickets = createAPIDemoTickets()
  } else if (projectId === '3') {
    demoTickets = createMOBDemoTickets()
  }

  // Populate columns with tickets
  return columns.map((col) => ({
    ...col,
    tickets: demoTickets
      .filter((dt) => dt.columnId === col.id)
      .map((dt) => dt.ticket)
      .sort((a, b) => a.order - b.order),
  }))
}
