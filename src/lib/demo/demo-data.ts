/**
 * Pre-seeded demo data for client-side demo mode
 *
 * This data is used to initialize localStorage when demo mode is enabled.
 */

import type {
  ColumnWithTickets,
  LabelSummary,
  SprintSummary,
  TicketWithRelations,
  UserSummary,
} from '@/types'
import { DEMO_TEAM_MEMBERS, DEMO_USER } from './demo-config'

// Demo user as UserSummary
export const DEMO_USER_SUMMARY: UserSummary = {
  id: DEMO_USER.id,
  username: DEMO_USER.username,
  name: DEMO_USER.name,
  email: DEMO_USER.email ?? '',
  avatar: DEMO_USER.avatar,
  isSystemAdmin: DEMO_USER.isSystemAdmin,
}

// Team members as UserSummary
export const DEMO_TEAM_SUMMARIES: UserSummary[] = DEMO_TEAM_MEMBERS.map((member) => ({
  id: member.id,
  username: member.username,
  name: member.name,
  email: member.email ?? '',
  avatar: member.avatar,
  isSystemAdmin: member.isSystemAdmin,
}))

// Helper to get team member by index
const getTeamMember = (index: number): UserSummary =>
  DEMO_TEAM_SUMMARIES[index % DEMO_TEAM_SUMMARIES.length]

// ============================================================================
// Projects
// ============================================================================

export interface DemoProject {
  id: string
  name: string
  key: string
  description: string | null
  color: string
  createdAt: Date
  updatedAt: Date
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'demo-project-1',
    name: 'Product Launch',
    key: 'LAUNCH',
    description: 'Q1 product launch planning and execution',
    color: '#6366f1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'demo-project-2',
    name: 'Bug Tracker',
    key: 'BUGS',
    description: 'Bug tracking and issue resolution',
    color: '#ef4444',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

// ============================================================================
// Columns (per project)
// ============================================================================

export interface DemoColumn {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  order: number
  projectId: string
}

export const DEMO_COLUMNS: DemoColumn[] = [
  // Project 1: Product Launch
  { id: 'demo-col-1-1', name: 'To Do', order: 0, projectId: 'demo-project-1' },
  { id: 'demo-col-1-2', name: 'In Progress', order: 1, projectId: 'demo-project-1' },
  { id: 'demo-col-1-3', name: 'Review', order: 2, projectId: 'demo-project-1' },
  { id: 'demo-col-1-4', name: 'Done', order: 3, projectId: 'demo-project-1' },
  // Project 2: Bug Tracker
  { id: 'demo-col-2-1', name: 'To Do', order: 0, projectId: 'demo-project-2' },
  { id: 'demo-col-2-2', name: 'In Progress', order: 1, projectId: 'demo-project-2' },
  { id: 'demo-col-2-3', name: 'Review', order: 2, projectId: 'demo-project-2' },
  { id: 'demo-col-2-4', name: 'Done', order: 3, projectId: 'demo-project-2' },
]

// ============================================================================
// Labels (per project)
// ============================================================================

export const DEMO_LABELS: (LabelSummary & { projectId: string })[] = [
  // Project 1: Product Launch
  { id: 'demo-label-1-1', name: 'feature', color: '#22c55e', projectId: 'demo-project-1' },
  { id: 'demo-label-1-2', name: 'enhancement', color: '#3b82f6', projectId: 'demo-project-1' },
  { id: 'demo-label-1-3', name: 'documentation', color: '#a855f7', projectId: 'demo-project-1' },
  { id: 'demo-label-1-4', name: 'urgent', color: '#f59e0b', projectId: 'demo-project-1' },
  { id: 'demo-label-1-5', name: 'blocked', color: '#991b1b', projectId: 'demo-project-1' },
  // Project 2: Bug Tracker
  { id: 'demo-label-2-1', name: 'bug', color: '#ef4444', projectId: 'demo-project-2' },
  { id: 'demo-label-2-2', name: 'critical', color: '#dc2626', projectId: 'demo-project-2' },
  { id: 'demo-label-2-3', name: 'performance', color: '#f59e0b', projectId: 'demo-project-2' },
  { id: 'demo-label-2-4', name: 'ui/ux', color: '#ec4899', projectId: 'demo-project-2' },
  { id: 'demo-label-2-5', name: 'backend', color: '#0891b2', projectId: 'demo-project-2' },
]

// ============================================================================
// Sprints (per project)
// ============================================================================

const now = new Date()
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

export const DEMO_SPRINTS: (SprintSummary & { projectId: string })[] = [
  // Project 1: Product Launch
  {
    id: 'demo-sprint-1-1',
    name: 'Sprint 1',
    status: 'completed',
    startDate: twoWeeksAgo,
    endDate: oneWeekAgo,
    goal: 'Complete initial planning and setup',
    projectId: 'demo-project-1',
  },
  {
    id: 'demo-sprint-1-2',
    name: 'Sprint 2',
    status: 'active',
    startDate: oneWeekAgo,
    endDate: oneWeekFromNow,
    goal: 'Develop core features',
    projectId: 'demo-project-1',
  },
  // Project 2: Bug Tracker
  {
    id: 'demo-sprint-2-1',
    name: 'Sprint 1',
    status: 'active',
    startDate: oneWeekAgo,
    endDate: oneWeekFromNow,
    goal: 'Fix critical bugs',
    projectId: 'demo-project-2',
  },
]

// ============================================================================
// Tickets
// ============================================================================

function createTicket(
  partial: Partial<TicketWithRelations> & {
    id: string
    number: number
    title: string
    projectId: string
    columnId: string
  },
): TicketWithRelations {
  return {
    description: null,
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: null,
    estimate: null,
    startDate: null,
    dueDate: null,
    resolution: null,
    environment: null,
    affectedVersion: null,
    fixVersion: null,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    assigneeId: null,
    creatorId: DEMO_USER.id,
    sprintId: null,
    parentId: null,
    isCarriedOver: false,
    carriedFromSprintId: null,
    carriedOverCount: 0,
    assignee: null,
    creator: DEMO_USER_SUMMARY,
    sprint: null,
    carriedFromSprint: null,
    labels: [],
    watchers: [],
    ...partial,
  }
}

// Helper to get labels by project and name
function getLabel(projectId: string, name: string): LabelSummary {
  const label = DEMO_LABELS.find((l) => l.projectId === projectId && l.name === name)
  if (!label) throw new Error(`Demo label "${name}" not found for project ${projectId}`)
  return { id: label.id, name: label.name, color: label.color }
}

// Helper to get sprint by project
function getSprint(projectId: string, name: string): SprintSummary | undefined {
  const sprint = DEMO_SPRINTS.find((s) => s.projectId === projectId && s.name === name)
  if (sprint) {
    return {
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal,
    }
  }
  return undefined
}

export const DEMO_TICKETS: TicketWithRelations[] = [
  // ============================================================================
  // Project 1: Product Launch
  // ============================================================================

  // To Do column (active sprint)
  createTicket({
    id: 'demo-ticket-1-1',
    number: 1,
    title: 'Create landing page design mockups',
    description:
      'Design initial mockups for the product landing page. Include mobile and desktop versions.',
    type: 'story',
    priority: 'high',
    order: 0,
    storyPoints: 5,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    labels: [getLabel('demo-project-1', 'feature')],
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
  }),
  createTicket({
    id: 'demo-ticket-1-2',
    number: 2,
    title: 'Set up analytics tracking',
    description: 'Implement Google Analytics and custom event tracking for user behavior analysis.',
    type: 'task',
    priority: 'medium',
    order: 1,
    storyPoints: 3,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
  }),
  createTicket({
    id: 'demo-ticket-1-3',
    number: 3,
    title: 'Write product documentation',
    description: 'Create comprehensive documentation for end users and developers.',
    type: 'task',
    priority: 'low',
    order: 2,
    storyPoints: 8,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'documentation')],
  }),
  // Backlog items (no sprint)
  createTicket({
    id: 'demo-ticket-1-9',
    number: 9,
    title: 'Implement email notification system',
    description:
      'Build email notification infrastructure for user alerts, password resets, and marketing communications.',
    type: 'story',
    priority: 'medium',
    order: 3,
    storyPoints: 8,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'feature')],
  }),
  createTicket({
    id: 'demo-ticket-1-10',
    number: 10,
    title: 'Add keyboard shortcuts for power users',
    description:
      'Implement keyboard shortcuts for common actions like navigation, creating tickets, and quick search.',
    type: 'task',
    priority: 'low',
    order: 4,
    storyPoints: 3,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'enhancement')],
  }),
  createTicket({
    id: 'demo-ticket-1-11',
    number: 11,
    title: 'Research third-party integrations',
    description:
      'Evaluate potential integrations with Slack, GitHub, and calendar apps. Document API requirements and effort estimates.',
    type: 'task',
    priority: 'low',
    order: 5,
    storyPoints: 5,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
  }),

  // In Progress column
  createTicket({
    id: 'demo-ticket-1-4',
    number: 4,
    title: 'Implement user authentication flow',
    description:
      'Build the complete authentication flow including login, registration, and password reset.',
    type: 'story',
    priority: 'highest',
    order: 0,
    storyPoints: 13,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-2',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-1', 'feature'), getLabel('demo-project-1', 'urgent')],
  }),
  createTicket({
    id: 'demo-ticket-1-5',
    number: 5,
    title: 'Design system component library',
    description: 'Create reusable UI components with consistent styling and accessibility.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 8,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-2',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
  }),

  // Review column
  createTicket({
    id: 'demo-ticket-1-6',
    number: 6,
    title: 'API endpoint documentation',
    description: 'Document all REST API endpoints with examples and response schemas.',
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: 3,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-3',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    labels: [getLabel('demo-project-1', 'documentation')],
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
  }),

  // Done column (from completed sprint)
  createTicket({
    id: 'demo-ticket-1-7',
    number: 7,
    title: 'Project setup and configuration',
    description: 'Initialize project repository, configure build tools and CI/CD pipeline.',
    type: 'task',
    priority: 'highest',
    order: 0,
    storyPoints: 5,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4',
    sprintId: 'demo-sprint-1-1',
    sprint: getSprint('demo-project-1', 'Sprint 1'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
  }),
  createTicket({
    id: 'demo-ticket-1-8',
    number: 8,
    title: 'Database schema design',
    description: 'Design and implement the initial database schema with migrations.',
    type: 'task',
    priority: 'high',
    order: 1,
    storyPoints: 8,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4',
    sprintId: 'demo-sprint-1-1',
    sprint: getSprint('demo-project-1', 'Sprint 1'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
  }),

  // ============================================================================
  // Project 2: Bug Tracker
  // ============================================================================

  // To Do column
  createTicket({
    id: 'demo-ticket-2-1',
    number: 1,
    title: 'Login form validation not working on Safari',
    description:
      'Users report that form validation messages are not displaying correctly on Safari browser.',
    type: 'bug',
    priority: 'high',
    order: 0,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    labels: [getLabel('demo-project-2', 'bug'), getLabel('demo-project-2', 'ui/ux')],
    environment: 'Production',
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
  }),
  createTicket({
    id: 'demo-ticket-2-2',
    number: 2,
    title: 'Dashboard charts not rendering on mobile',
    description:
      'Chart components fail to render on mobile devices with screen width less than 768px.',
    type: 'bug',
    priority: 'medium',
    order: 1,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    labels: [getLabel('demo-project-2', 'bug'), getLabel('demo-project-2', 'ui/ux')],
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
  }),

  // In Progress column
  createTicket({
    id: 'demo-ticket-2-3',
    number: 3,
    title: 'Memory leak in real-time updates',
    description:
      'Application memory usage grows continuously when real-time update feature is enabled.',
    type: 'bug',
    priority: 'critical',
    order: 0,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-2',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [
      getLabel('demo-project-2', 'critical'),
      getLabel('demo-project-2', 'performance'),
      getLabel('demo-project-2', 'backend'),
    ],
    environment: 'Production',
  }),

  // Review column
  createTicket({
    id: 'demo-ticket-2-4',
    number: 4,
    title: 'File upload fails for large images',
    description: 'Images larger than 5MB fail to upload with a generic error message.',
    type: 'bug',
    priority: 'high',
    order: 0,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-3',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    labels: [getLabel('demo-project-2', 'bug'), getLabel('demo-project-2', 'backend')],
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
  }),

  // Done column
  createTicket({
    id: 'demo-ticket-2-5',
    number: 5,
    title: 'Dark mode toggle not persisting',
    description: 'User preference for dark mode resets after page refresh.',
    type: 'bug',
    priority: 'low',
    order: 0,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-4',
    labels: [getLabel('demo-project-2', 'bug'), getLabel('demo-project-2', 'ui/ux')],
  }),
  createTicket({
    id: 'demo-ticket-2-6',
    number: 6,
    title: 'Session timeout not redirecting properly',
    description: 'When session expires, user is not redirected to login page.',
    type: 'bug',
    priority: 'medium',
    order: 1,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-4',
    labels: [getLabel('demo-project-2', 'bug')],
  }),
]

// ============================================================================
// Helper functions to build ColumnWithTickets structures
// ============================================================================

export function getColumnsWithTickets(projectId: string): ColumnWithTickets[] {
  const projectColumns = DEMO_COLUMNS.filter((c) => c.projectId === projectId)
  const projectTickets = DEMO_TICKETS.filter((t) => t.projectId === projectId)

  return projectColumns.map((col) => ({
    id: col.id,
    name: col.name,
    icon: col.icon ?? null,
    color: col.color ?? null,
    order: col.order,
    projectId: col.projectId,
    tickets: projectTickets.filter((t) => t.columnId === col.id).sort((a, b) => a.order - b.order),
  }))
}

export function getProjectLabels(projectId: string): LabelSummary[] {
  return DEMO_LABELS.filter((l) => l.projectId === projectId).map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  }))
}

export function getProjectSprints(projectId: string): SprintSummary[] {
  return DEMO_SPRINTS.filter((s) => s.projectId === projectId).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    startDate: s.startDate,
    endDate: s.endDate,
    goal: s.goal,
  }))
}

// ============================================================================
// Default roles for demo mode (matches production role presets)
// ============================================================================

export const DEMO_ROLES = [
  {
    id: 'demo-role-owner',
    name: 'Owner',
    color: '#f59e0b',
    description: 'Full control over the project including deletion and permission management',
    isDefault: true,
    position: 0,
  },
  {
    id: 'demo-role-admin',
    name: 'Admin',
    color: '#3b82f6',
    description: 'Can manage most project settings, members, and content',
    isDefault: true,
    position: 1,
  },
  {
    id: 'demo-role-member',
    name: 'Member',
    color: '#6b7280',
    description: 'Can create tickets and manage their own content',
    isDefault: true,
    position: 2,
  },
] as const

// Export individual roles for backward compatibility
export const DEMO_ROLE = DEMO_ROLES[0]
export const DEMO_ROLE_ADMIN = DEMO_ROLES[1]
export const DEMO_ROLE_MEMBER = DEMO_ROLES[2]

// Helper to get a role by name
export function getDemoRole(name: 'Owner' | 'Admin' | 'Member') {
  const role = DEMO_ROLES.find((r) => r.name === name)
  if (!role) {
    throw new Error(`Demo role not found: ${name}`)
  }
  return role
}

// ============================================================================
// Demo members (all demo users assigned to projects with varied roles)
// ============================================================================

export const DEMO_MEMBERS = [
  // Demo User - Owner of both projects
  {
    id: 'demo-member-1',
    roleId: DEMO_ROLE.id,
    overrides: null,
    userId: DEMO_USER.id,
    role: DEMO_ROLE,
    user: DEMO_USER_SUMMARY,
  },
  // Sarah Chen - Admin on Project 1, Member on Project 2
  {
    id: 'demo-member-2',
    roleId: DEMO_ROLE_ADMIN.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[0].id,
    role: DEMO_ROLE_ADMIN,
    user: DEMO_TEAM_SUMMARIES[0],
    projectMapping: { 'demo-project-1': 'Admin', 'demo-project-2': 'Member' },
  },
  // Marcus Johnson - Member on both projects
  {
    id: 'demo-member-3',
    roleId: DEMO_ROLE_MEMBER.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[1].id,
    role: DEMO_ROLE_MEMBER,
    user: DEMO_TEAM_SUMMARIES[1],
  },
  // Emily Rodriguez - Admin on Project 2, Member on Project 1
  {
    id: 'demo-member-4',
    roleId: DEMO_ROLE_MEMBER.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[2].id,
    role: DEMO_ROLE_MEMBER,
    user: DEMO_TEAM_SUMMARIES[2],
    projectMapping: { 'demo-project-1': 'Member', 'demo-project-2': 'Admin' },
  },
] as const

// Legacy export for backward compatibility
export const DEMO_MEMBER = DEMO_MEMBERS[0]

/**
 * Get demo members for a specific project with correct roles
 */
export function getDemoMembersForProject(projectId: string) {
  return DEMO_MEMBERS.map((member) => {
    // Check if member has project-specific role mapping
    const projectMapping = 'projectMapping' in member ? member.projectMapping : null
    if (projectMapping && projectId in projectMapping) {
      const roleName = projectMapping[projectId as keyof typeof projectMapping]
      const role = getDemoRole(roleName as 'Owner' | 'Admin' | 'Member')
      return {
        id: `${member.id}-${projectId}`,
        roleId: role.id,
        overrides: null,
        userId: member.userId,
        role,
        user: member.user,
      }
    }
    // Default: use the member's default role
    return {
      id: `${member.id}-${projectId}`,
      roleId: member.roleId,
      overrides: null,
      userId: member.userId,
      role: member.role,
      user: member.user,
    }
  })
}

/**
 * Get demo roles with member counts for a specific project
 */
export function getDemoRolesForProject(projectId: string) {
  const members = getDemoMembersForProject(projectId)
  return DEMO_ROLES.map((role) => ({
    ...role,
    memberCount: members.filter((m) => m.roleId === role.id).length,
  }))
}
