/**
 * Pre-seeded demo data for client-side demo mode
 *
 * This data is used to initialize localStorage when demo mode is enabled.
 * It showcases a realistic software development team scenario with:
 * - Multiple projects with different colors
 * - Various ticket types (epic, story, task, bug)
 * - Sprint states (planning, active, completed)
 * - Labels, assignees, story points, estimates, and due dates
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
    name: 'Mobile App',
    key: 'MOBILE',
    description: 'Cross-platform mobile app for iOS and Android with React Native',
    color: '#6366f1', // Indigo
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'demo-project-2',
    name: 'Backend API',
    key: 'API',
    description: 'RESTful API service with authentication, real-time updates, and data persistence',
    color: '#10b981', // Emerald
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'demo-project-3',
    name: 'Design System',
    key: 'DESIGN',
    description: 'Shared component library and design tokens for consistent UI across products',
    color: '#f59e0b', // Amber
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
  // Project 1: Mobile App
  { id: 'demo-col-1-1', name: 'To Do', order: 0, projectId: 'demo-project-1' },
  { id: 'demo-col-1-2', name: 'In Progress', order: 1, projectId: 'demo-project-1' },
  { id: 'demo-col-1-3', name: 'In Review', order: 2, projectId: 'demo-project-1' },
  { id: 'demo-col-1-4', name: 'Done', order: 3, projectId: 'demo-project-1' },
  // Project 2: Backend API
  { id: 'demo-col-2-1', name: 'To Do', order: 0, projectId: 'demo-project-2' },
  { id: 'demo-col-2-2', name: 'In Progress', order: 1, projectId: 'demo-project-2' },
  { id: 'demo-col-2-3', name: 'Code Review', order: 2, projectId: 'demo-project-2' },
  { id: 'demo-col-2-4', name: 'QA Testing', order: 3, projectId: 'demo-project-2' },
  { id: 'demo-col-2-5', name: 'Done', order: 4, projectId: 'demo-project-2' },
  // Project 3: Design System
  { id: 'demo-col-3-1', name: 'Backlog', order: 0, projectId: 'demo-project-3' },
  { id: 'demo-col-3-2', name: 'In Design', order: 1, projectId: 'demo-project-3' },
  { id: 'demo-col-3-3', name: 'In Development', order: 2, projectId: 'demo-project-3' },
  { id: 'demo-col-3-4', name: 'Review', order: 3, projectId: 'demo-project-3' },
  { id: 'demo-col-3-5', name: 'Published', order: 4, projectId: 'demo-project-3' },
]

// ============================================================================
// Labels (per project)
// ============================================================================

export const DEMO_LABELS: (LabelSummary & { projectId: string })[] = [
  // Project 1: Mobile App
  { id: 'demo-label-1-1', name: 'ios', color: '#000000', projectId: 'demo-project-1' },
  { id: 'demo-label-1-2', name: 'android', color: '#3ddc84', projectId: 'demo-project-1' },
  { id: 'demo-label-1-3', name: 'ui', color: '#ec4899', projectId: 'demo-project-1' },
  { id: 'demo-label-1-4', name: 'performance', color: '#f59e0b', projectId: 'demo-project-1' },
  { id: 'demo-label-1-5', name: 'accessibility', color: '#8b5cf6', projectId: 'demo-project-1' },
  { id: 'demo-label-1-6', name: 'offline', color: '#6b7280', projectId: 'demo-project-1' },
  // Project 2: Backend API
  { id: 'demo-label-2-1', name: 'security', color: '#ef4444', projectId: 'demo-project-2' },
  { id: 'demo-label-2-2', name: 'database', color: '#3b82f6', projectId: 'demo-project-2' },
  { id: 'demo-label-2-3', name: 'auth', color: '#10b981', projectId: 'demo-project-2' },
  { id: 'demo-label-2-4', name: 'api', color: '#6366f1', projectId: 'demo-project-2' },
  { id: 'demo-label-2-5', name: 'performance', color: '#f59e0b', projectId: 'demo-project-2' },
  { id: 'demo-label-2-6', name: 'documentation', color: '#a855f7', projectId: 'demo-project-2' },
  // Project 3: Design System
  { id: 'demo-label-3-1', name: 'component', color: '#3b82f6', projectId: 'demo-project-3' },
  { id: 'demo-label-3-2', name: 'token', color: '#10b981', projectId: 'demo-project-3' },
  { id: 'demo-label-3-3', name: 'documentation', color: '#a855f7', projectId: 'demo-project-3' },
  { id: 'demo-label-3-4', name: 'breaking-change', color: '#ef4444', projectId: 'demo-project-3' },
  { id: 'demo-label-3-5', name: 'accessibility', color: '#8b5cf6', projectId: 'demo-project-3' },
]

// ============================================================================
// Sprints (per project)
// ============================================================================

const now = new Date()
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)

export const DEMO_SPRINTS: (SprintSummary & { projectId: string })[] = [
  // Project 1: Mobile App - shows all sprint states
  {
    id: 'demo-sprint-1-1',
    name: 'Sprint 1',
    status: 'completed',
    startDate: threeWeeksAgo,
    endDate: twoWeeksAgo,
    goal: 'Setup project infrastructure and basic navigation',
    budget: 20,
    projectId: 'demo-project-1',
  },
  {
    id: 'demo-sprint-1-2',
    name: 'Sprint 2',
    status: 'completed',
    startDate: twoWeeksAgo,
    endDate: oneWeekAgo,
    goal: 'Implement authentication and user profile',
    budget: 30,
    projectId: 'demo-project-1',
  },
  {
    id: 'demo-sprint-1-3',
    name: 'Sprint 3',
    status: 'active',
    startDate: oneWeekAgo,
    endDate: oneWeekFromNow,
    goal: 'Build core features: dashboard and notifications',
    budget: 35,
    projectId: 'demo-project-1',
  },
  {
    id: 'demo-sprint-1-4',
    name: 'Sprint 4',
    status: 'planning',
    startDate: null,
    endDate: null,
    goal: 'Offline mode and performance optimization',
    budget: 30,
    projectId: 'demo-project-1',
  },
  // Project 2: Backend API
  {
    id: 'demo-sprint-2-1',
    name: 'Sprint 1',
    status: 'completed',
    startDate: twoWeeksAgo,
    endDate: oneWeekAgo,
    goal: 'Setup authentication and basic CRUD endpoints',
    budget: 25,
    projectId: 'demo-project-2',
  },
  {
    id: 'demo-sprint-2-2',
    name: 'Sprint 2',
    status: 'active',
    startDate: oneWeekAgo,
    endDate: oneWeekFromNow,
    goal: 'Real-time updates and notification service',
    budget: 30,
    projectId: 'demo-project-2',
  },
  // Project 3: Design System
  {
    id: 'demo-sprint-3-1',
    name: 'Q1 Release',
    status: 'active',
    startDate: twoWeeksAgo,
    endDate: twoWeeksFromNow,
    goal: 'Ship core components: Button, Input, Modal, Card',
    budget: 40,
    projectId: 'demo-project-3',
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
    resolvedAt: null,
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
  // Project 1: Mobile App
  // ============================================================================

  // Epic: User Authentication (Done - Sprint 2)
  createTicket({
    id: 'demo-ticket-1-1',
    number: 1,
    title: 'User Authentication Epic',
    description:
      'Complete authentication system including login, registration, password reset, and biometric authentication.',
    type: 'epic',
    priority: 'highest',
    order: 0,
    storyPoints: 21,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4', // Done
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-1', 'ios'), getLabel('demo-project-1', 'android')],
  }),

  // Done items from Sprint 2
  createTicket({
    id: 'demo-ticket-1-2',
    number: 2,
    title: 'Implement login screen',
    description:
      'Create login screen with email/password fields, validation, and error handling. Include "forgot password" link.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    parentId: 'demo-ticket-1-1',
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-1', 'ui')],
  }),
  createTicket({
    id: 'demo-ticket-1-3',
    number: 3,
    title: 'Add biometric authentication',
    description:
      'Integrate Face ID for iOS and fingerprint for Android. Fall back to PIN if biometrics unavailable.',
    type: 'story',
    priority: 'medium',
    order: 2,
    storyPoints: 8,
    estimate: '6h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4',
    sprintId: 'demo-sprint-1-2',
    sprint: getSprint('demo-project-1', 'Sprint 2'),
    parentId: 'demo-ticket-1-1',
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
    labels: [getLabel('demo-project-1', 'ios'), getLabel('demo-project-1', 'android')],
  }),

  // Active Sprint 3 - In Progress
  createTicket({
    id: 'demo-ticket-1-4',
    number: 4,
    title: 'Dashboard screen implementation',
    description:
      'Build the main dashboard with activity feed, quick actions, and summary cards. Must support pull-to-refresh.',
    type: 'story',
    priority: 'highest',
    order: 0,
    storyPoints: 13,
    estimate: '2d',
    dueDate: threeDaysFromNow,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-2', // In Progress
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-1', 'ui')],
  }),
  createTicket({
    id: 'demo-ticket-1-5',
    number: 5,
    title: 'Push notification service integration',
    description:
      'Integrate Firebase Cloud Messaging for Android and APNs for iOS. Handle notification permissions and deep linking.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 8,
    estimate: '1d',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-2',
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
    labels: [getLabel('demo-project-1', 'ios'), getLabel('demo-project-1', 'android')],
  }),

  // Active Sprint 3 - In Review
  createTicket({
    id: 'demo-ticket-1-6',
    number: 6,
    title: 'Settings screen with notification preferences',
    description:
      'User settings page with profile editing, notification toggles, and app preferences.',
    type: 'story',
    priority: 'medium',
    order: 0,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-3', // In Review
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-1', 'ui')],
  }),

  // Active Sprint 3 - To Do
  createTicket({
    id: 'demo-ticket-1-7',
    number: 7,
    title: 'Fix keyboard avoiding view on Android',
    description:
      'Keyboard overlaps input fields on certain Android devices. Need to adjust layout and test on multiple screen sizes.',
    type: 'bug',
    priority: 'high',
    order: 0,
    storyPoints: 3,
    estimate: '2h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1', // To Do
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
    labels: [getLabel('demo-project-1', 'android'), getLabel('demo-project-1', 'ui')],
    environment: 'Android 13+',
  }),
  createTicket({
    id: 'demo-ticket-1-8',
    number: 8,
    title: 'Add loading skeletons',
    description:
      'Replace loading spinners with skeleton screens for better perceived performance. Apply to lists and cards.',
    type: 'task',
    priority: 'low',
    order: 1,
    storyPoints: 2,
    estimate: '2h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    labels: [getLabel('demo-project-1', 'ui'), getLabel('demo-project-1', 'performance')],
  }),

  // Sprint 3 - Done (carried over from Sprint 2)
  createTicket({
    id: 'demo-ticket-1-9',
    number: 9,
    title: 'User profile avatar upload',
    description:
      'Allow users to upload and crop profile photos. Support camera and gallery selection.',
    type: 'story',
    priority: 'medium',
    order: 0,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-4',
    sprintId: 'demo-sprint-1-3',
    sprint: getSprint('demo-project-1', 'Sprint 3'),
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
    labels: [getLabel('demo-project-1', 'ui')],
    isCarriedOver: true,
    carriedFromSprintId: 'demo-sprint-1-2',
    carriedOverCount: 1,
  }),

  // Planning Sprint 4 - Backlog items planned
  createTicket({
    id: 'demo-ticket-1-10',
    number: 10,
    title: 'Offline Mode Epic',
    description:
      'Enable the app to work offline with local data caching and sync when connection is restored.',
    type: 'epic',
    priority: 'high',
    order: 0,
    storyPoints: 34,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-4',
    sprint: getSprint('demo-project-1', 'Sprint 4'),
    labels: [getLabel('demo-project-1', 'offline')],
  }),
  createTicket({
    id: 'demo-ticket-1-11',
    number: 11,
    title: 'Implement local SQLite database',
    description: 'Set up SQLite for local data persistence. Define schema mirroring server models.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 8,
    estimate: '1d',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-4',
    sprint: getSprint('demo-project-1', 'Sprint 4'),
    parentId: 'demo-ticket-1-10',
    labels: [getLabel('demo-project-1', 'offline')],
  }),
  createTicket({
    id: 'demo-ticket-1-12',
    number: 12,
    title: 'Background sync service',
    description:
      'Create a service that syncs local changes to server when network becomes available. Handle conflicts.',
    type: 'story',
    priority: 'high',
    order: 2,
    storyPoints: 13,
    estimate: '2d',
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    sprintId: 'demo-sprint-1-4',
    sprint: getSprint('demo-project-1', 'Sprint 4'),
    parentId: 'demo-ticket-1-10',
    labels: [getLabel('demo-project-1', 'offline')],
  }),

  // Unassigned backlog items (no sprint)
  createTicket({
    id: 'demo-ticket-1-13',
    number: 13,
    title: 'Implement dark mode',
    description:
      'Add system-aware dark mode with manual toggle option. Update all screens and components.',
    type: 'story',
    priority: 'medium',
    order: 3,
    storyPoints: 8,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'ui'), getLabel('demo-project-1', 'accessibility')],
  }),
  createTicket({
    id: 'demo-ticket-1-14',
    number: 14,
    title: 'Add haptic feedback',
    description:
      'Implement haptic feedback for button presses, success/error states, and pull-to-refresh.',
    type: 'task',
    priority: 'low',
    order: 4,
    storyPoints: 2,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'ios'), getLabel('demo-project-1', 'android')],
  }),
  createTicket({
    id: 'demo-ticket-1-15',
    number: 15,
    title: 'VoiceOver and TalkBack accessibility audit',
    description:
      'Conduct full accessibility audit. Ensure all interactive elements have proper labels and the app is navigable with screen readers.',
    type: 'task',
    priority: 'high',
    order: 5,
    storyPoints: 5,
    projectId: 'demo-project-1',
    columnId: 'demo-col-1-1',
    labels: [getLabel('demo-project-1', 'accessibility')],
  }),

  // ============================================================================
  // Project 2: Backend API
  // ============================================================================

  // Completed Sprint 1
  createTicket({
    id: 'demo-ticket-2-1',
    number: 1,
    title: 'Set up project with Express and TypeScript',
    description:
      'Initialize Node.js project with Express, TypeScript, and proper folder structure.',
    type: 'task',
    priority: 'highest',
    order: 0,
    storyPoints: 3,
    estimate: '2h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-5', // Done
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-2', 'api')],
  }),
  createTicket({
    id: 'demo-ticket-2-2',
    number: 2,
    title: 'JWT authentication middleware',
    description: 'Implement JWT-based authentication with access and refresh tokens.',
    type: 'story',
    priority: 'highest',
    order: 1,
    storyPoints: 8,
    estimate: '6h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-5',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
    labels: [getLabel('demo-project-2', 'auth'), getLabel('demo-project-2', 'security')],
  }),
  createTicket({
    id: 'demo-ticket-2-3',
    number: 3,
    title: 'User CRUD endpoints',
    description: 'Create REST endpoints for user registration, profile update, and deletion.',
    type: 'story',
    priority: 'high',
    order: 2,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-5',
    sprintId: 'demo-sprint-2-1',
    sprint: getSprint('demo-project-2', 'Sprint 1'),
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-2', 'api')],
  }),

  // Active Sprint 2 - In Progress
  createTicket({
    id: 'demo-ticket-2-4',
    number: 4,
    title: 'WebSocket server for real-time updates',
    description:
      'Set up Socket.io server for real-time notifications and live data updates. Handle connection management and rooms.',
    type: 'story',
    priority: 'highest',
    order: 0,
    storyPoints: 13,
    estimate: '2d',
    dueDate: fiveDaysFromNow,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-2', // In Progress
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-2', 'api')],
  }),
  createTicket({
    id: 'demo-ticket-2-5',
    number: 5,
    title: 'Email notification service',
    description:
      'Integrate SendGrid for transactional emails. Create templates for welcome, password reset, and notifications.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-2',
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
  }),

  // Active Sprint 2 - Code Review
  createTicket({
    id: 'demo-ticket-2-6',
    number: 6,
    title: 'Rate limiting middleware',
    description:
      'Implement rate limiting with Redis to prevent abuse. Different limits for authenticated vs anonymous users.',
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: 5,
    estimate: '3h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-3', // Code Review
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
    labels: [getLabel('demo-project-2', 'security'), getLabel('demo-project-2', 'performance')],
  }),

  // Active Sprint 2 - QA Testing
  createTicket({
    id: 'demo-ticket-2-7',
    number: 7,
    title: 'Fix refresh token expiration handling',
    description:
      'Refresh tokens are not being invalidated properly after password change. Security vulnerability.',
    type: 'bug',
    priority: 'critical',
    order: 0,
    storyPoints: 3,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-4', // QA Testing
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-2', 'auth'), getLabel('demo-project-2', 'security')],
    environment: 'Production',
  }),

  // Active Sprint 2 - To Do
  createTicket({
    id: 'demo-ticket-2-8',
    number: 8,
    title: 'Add request validation with Zod',
    description: 'Implement Zod schemas for all endpoints. Return clear validation error messages.',
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: 5,
    estimate: '4h',
    dueDate: oneWeekFromNow,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1', // To Do
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    labels: [getLabel('demo-project-2', 'api')],
  }),
  createTicket({
    id: 'demo-ticket-2-9',
    number: 9,
    title: 'OpenAPI documentation',
    description: 'Generate OpenAPI 3.0 spec from endpoint definitions. Set up Swagger UI.',
    type: 'task',
    priority: 'low',
    order: 1,
    storyPoints: 3,
    estimate: '3h',
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    sprintId: 'demo-sprint-2-2',
    sprint: getSprint('demo-project-2', 'Sprint 2'),
    labels: [getLabel('demo-project-2', 'documentation')],
  }),

  // Backlog (no sprint)
  createTicket({
    id: 'demo-ticket-2-10',
    number: 10,
    title: 'Database query optimization',
    description: 'Analyze slow queries and add appropriate indexes. Set up query monitoring.',
    type: 'task',
    priority: 'medium',
    order: 2,
    storyPoints: 8,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    labels: [getLabel('demo-project-2', 'database'), getLabel('demo-project-2', 'performance')],
  }),
  createTicket({
    id: 'demo-ticket-2-11',
    number: 11,
    title: 'Implement soft delete for all models',
    description:
      'Add deletedAt column and update queries to filter deleted records. Allow admin to restore.',
    type: 'story',
    priority: 'low',
    order: 3,
    storyPoints: 5,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    labels: [getLabel('demo-project-2', 'database')],
  }),
  createTicket({
    id: 'demo-ticket-2-12',
    number: 12,
    title: 'File upload service with S3',
    description: 'Set up file upload to S3 with presigned URLs, size limits, and virus scanning.',
    type: 'story',
    priority: 'medium',
    order: 4,
    storyPoints: 8,
    projectId: 'demo-project-2',
    columnId: 'demo-col-2-1',
    labels: [getLabel('demo-project-2', 'api')],
  }),

  // ============================================================================
  // Project 3: Design System
  // ============================================================================

  // Active Q1 Release - In Development
  createTicket({
    id: 'demo-ticket-3-1',
    number: 1,
    title: 'Button component',
    description:
      'Core button component with variants: primary, secondary, outline, ghost. Include sizes: sm, md, lg. Support loading and disabled states.',
    type: 'story',
    priority: 'highest',
    order: 0,
    storyPoints: 8,
    estimate: '1d',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-3', // In Development
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-3', 'component'), getLabel('demo-project-3', 'accessibility')],
  }),
  createTicket({
    id: 'demo-ticket-3-2',
    number: 2,
    title: 'Input field component',
    description:
      'Text input with label, placeholder, error state, and helper text. Support types: text, email, password, number.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 8,
    estimate: '1d',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-3',
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: getTeamMember(2).id,
    assignee: getTeamMember(2),
    labels: [getLabel('demo-project-3', 'component')],
  }),

  // Active Q1 Release - Review
  createTicket({
    id: 'demo-ticket-3-3',
    number: 3,
    title: 'Color tokens documentation',
    description:
      'Document all color tokens including semantic colors, palette variations, and accessibility contrast ratios.',
    type: 'task',
    priority: 'medium',
    order: 0,
    storyPoints: 3,
    estimate: '3h',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-4', // Review
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-3', 'token'), getLabel('demo-project-3', 'documentation')],
  }),

  // Published (Done)
  createTicket({
    id: 'demo-ticket-3-4',
    number: 4,
    title: 'Typography scale and tokens',
    description:
      'Define typography scale with font families, sizes, weights, and line heights. Export as CSS variables and JS constants.',
    type: 'story',
    priority: 'highest',
    order: 0,
    storyPoints: 5,
    estimate: '4h',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-5', // Published
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: DEMO_USER.id,
    assignee: DEMO_USER_SUMMARY,
    labels: [getLabel('demo-project-3', 'token')],
  }),
  createTicket({
    id: 'demo-ticket-3-5',
    number: 5,
    title: 'Spacing and layout tokens',
    description:
      'Define 8px grid-based spacing scale. Include tokens for margins, padding, and gaps.',
    type: 'story',
    priority: 'high',
    order: 1,
    storyPoints: 3,
    estimate: '2h',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-5',
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: getTeamMember(1).id,
    assignee: getTeamMember(1),
    labels: [getLabel('demo-project-3', 'token')],
  }),

  // In Design
  createTicket({
    id: 'demo-ticket-3-6',
    number: 6,
    title: 'Modal/Dialog component',
    description:
      'Modal component with header, body, footer sections. Support sizes and focus trapping. Include confirmation dialog variant.',
    type: 'story',
    priority: 'high',
    order: 0,
    storyPoints: 13,
    estimate: '2d',
    dueDate: tenDaysFromNow,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-2', // In Design
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    assigneeId: getTeamMember(0).id,
    assignee: getTeamMember(0),
    labels: [getLabel('demo-project-3', 'component'), getLabel('demo-project-3', 'accessibility')],
  }),
  createTicket({
    id: 'demo-ticket-3-7',
    number: 7,
    title: 'Card component',
    description:
      'Flexible card container with header, content, footer, and media slots. Support elevated and outlined variants.',
    type: 'story',
    priority: 'medium',
    order: 1,
    storyPoints: 8,
    estimate: '1d',
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-2',
    sprintId: 'demo-sprint-3-1',
    sprint: getSprint('demo-project-3', 'Q1 Release'),
    labels: [getLabel('demo-project-3', 'component')],
  }),

  // Backlog
  createTicket({
    id: 'demo-ticket-3-8',
    number: 8,
    title: 'Dropdown/Select component',
    description:
      'Custom dropdown with search, multi-select, and groups. Ensure keyboard navigation and screen reader support.',
    type: 'story',
    priority: 'high',
    order: 0,
    storyPoints: 13,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-1', // Backlog
    labels: [getLabel('demo-project-3', 'component'), getLabel('demo-project-3', 'accessibility')],
  }),
  createTicket({
    id: 'demo-ticket-3-9',
    number: 9,
    title: 'Table component',
    description:
      'Data table with sorting, filtering, pagination, and row selection. Support fixed headers and horizontal scroll.',
    type: 'story',
    priority: 'medium',
    order: 1,
    storyPoints: 21,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-1',
    labels: [getLabel('demo-project-3', 'component')],
  }),
  createTicket({
    id: 'demo-ticket-3-10',
    number: 10,
    title: 'Toast notification component',
    description:
      'Toast notifications with variants: success, error, warning, info. Auto-dismiss with configurable duration.',
    type: 'story',
    priority: 'medium',
    order: 2,
    storyPoints: 5,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-1',
    labels: [getLabel('demo-project-3', 'component')],
  }),
  createTicket({
    id: 'demo-ticket-3-11',
    number: 11,
    title: 'Update Button API to match new spec',
    description:
      'Breaking change: rename `type` prop to `variant`. Update documentation and migration guide.',
    type: 'task',
    priority: 'high',
    order: 3,
    storyPoints: 3,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-1',
    labels: [
      getLabel('demo-project-3', 'breaking-change'),
      getLabel('demo-project-3', 'documentation'),
    ],
  }),
  createTicket({
    id: 'demo-ticket-3-12',
    number: 12,
    title: 'Icon library integration',
    description:
      'Integrate icon library with tree-shaking support. Create Icon component wrapper with size and color props.',
    type: 'story',
    priority: 'low',
    order: 4,
    storyPoints: 5,
    projectId: 'demo-project-3',
    columnId: 'demo-col-3-1',
    labels: [getLabel('demo-project-3', 'component')],
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
  // Demo User - Owner of all projects
  {
    id: 'demo-member-1',
    roleId: DEMO_ROLE.id,
    overrides: null,
    userId: DEMO_USER.id,
    role: DEMO_ROLE,
    user: DEMO_USER_SUMMARY,
  },
  // Sarah Chen - Admin on Mobile App and Design System, Member on Backend API
  {
    id: 'demo-member-2',
    roleId: DEMO_ROLE_ADMIN.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[0].id,
    role: DEMO_ROLE_ADMIN,
    user: DEMO_TEAM_SUMMARIES[0],
    projectMapping: {
      'demo-project-1': 'Admin',
      'demo-project-2': 'Member',
      'demo-project-3': 'Admin',
    },
  },
  // Marcus Johnson - Member on all projects (backend focused)
  {
    id: 'demo-member-3',
    roleId: DEMO_ROLE_MEMBER.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[1].id,
    role: DEMO_ROLE_MEMBER,
    user: DEMO_TEAM_SUMMARIES[1],
  },
  // Emily Rodriguez - Admin on Backend API, Member on others
  {
    id: 'demo-member-4',
    roleId: DEMO_ROLE_MEMBER.id,
    overrides: null,
    userId: DEMO_TEAM_SUMMARIES[2].id,
    role: DEMO_ROLE_MEMBER,
    user: DEMO_TEAM_SUMMARIES[2],
    projectMapping: {
      'demo-project-1': 'Member',
      'demo-project-2': 'Admin',
      'demo-project-3': 'Member',
    },
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
