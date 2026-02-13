/**
 * Shared Prisma select clauses and transform functions.
 * Centralizes commonly used select patterns to avoid duplication across API routes.
 */

/**
 * User summary fields commonly used when including user relations.
 */
export const USER_SELECT_SUMMARY = {
  id: true,
  username: true,
  name: true,
  email: true,
  avatar: true,
  avatarColor: true,
} as const

/**
 * Sprint summary fields commonly used when including sprint relations.
 */
export const SPRINT_SELECT_SUMMARY = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  goal: true,
  budget: true,
} as const

/**
 * Full sprint select with all fields including completion metrics.
 */
export const SPRINT_SELECT_FULL = {
  id: true,
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  budget: true,
  completedAt: true,
  completedById: true,
  completedTicketCount: true,
  incompleteTicketCount: true,
  completedStoryPoints: true,
  incompleteStoryPoints: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
} as const

/**
 * Label fields commonly used when including label relations.
 */
export const LABEL_SELECT = {
  id: true,
  name: true,
  color: true,
} as const

/**
 * Attachment fields commonly used when including attachment relations.
 */
export const ATTACHMENT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  url: true,
  createdAt: true,
} as const

/**
 * Full ticket select with all relations for API responses.
 * Use this for GET endpoints that return complete ticket data.
 */
export const TICKET_SELECT_FULL = {
  id: true,
  number: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  order: true,
  storyPoints: true,
  estimate: true,
  startDate: true,
  dueDate: true,
  resolution: true,
  resolvedAt: true,
  environment: true,
  affectedVersion: true,
  fixVersion: true,
  createdAt: true,
  updatedAt: true,
  projectId: true,
  columnId: true,
  assigneeId: true,
  creatorId: true,
  sprintId: true,
  parentId: true,
  // Carryover tracking
  isCarriedOver: true,
  carriedFromSprintId: true,
  carriedOverCount: true,
  column: {
    select: { id: true, name: true, icon: true, color: true },
  },
  project: {
    select: { id: true, key: true, name: true },
  },
  assignee: {
    select: USER_SELECT_SUMMARY,
  },
  creator: {
    select: USER_SELECT_SUMMARY,
  },
  sprint: {
    select: SPRINT_SELECT_SUMMARY,
  },
  carriedFromSprint: {
    select: SPRINT_SELECT_SUMMARY,
  },
  parent: {
    select: { id: true, number: true, title: true, type: true },
  },
  labels: {
    select: LABEL_SELECT,
  },
  watchers: {
    select: {
      user: {
        select: USER_SELECT_SUMMARY,
      },
    },
  },
  attachments: {
    select: ATTACHMENT_SELECT,
    orderBy: { createdAt: 'desc' as const },
  },
  linkedFrom: {
    select: {
      id: true,
      linkType: true,
      toTicket: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          priority: true,
          columnId: true,
          resolution: true,
        },
      },
    },
  },
  linkedTo: {
    select: {
      id: true,
      linkType: true,
      fromTicket: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          priority: true,
          columnId: true,
          resolution: true,
        },
      },
    },
  },
  _count: {
    select: {
      comments: true,
      subtasks: true,
      attachments: true,
    },
  },
} as const

/**
 * Type for the watcher relation as returned from Prisma.
 */
export type TicketWatcher = {
  user: {
    id: string
    username: string
    name: string
    email: string | null
    avatar: string | null
    avatarColor: string | null
  }
}

/**
 * Type for link relations as returned from Prisma.
 */
type LinkedFromEntry = {
  id: string
  linkType: string
  toTicket: {
    id: string
    number: number
    title: string
    type: string
    priority: string
    columnId: string
    resolution: string | null
  }
}

type LinkedToEntry = {
  id: string
  linkType: string
  fromTicket: {
    id: string
    number: number
    title: string
    type: string
    priority: string
    columnId: string
    resolution: string | null
  }
}

/**
 * Type for a ticket as returned from Prisma with TICKET_SELECT_FULL.
 */
export type TicketWithRelations = {
  watchers: TicketWatcher[]
  linkedFrom: LinkedFromEntry[]
  linkedTo: LinkedToEntry[]
  [key: string]: unknown
}

/**
 * Transforms a ticket from Prisma format to API response format.
 * Flattens the watchers relation from { user: {...} } to just the user object.
 * Merges linkedFrom/linkedTo into a unified links array with computed direction.
 *
 * @param ticket - Ticket with watchers and link relations from Prisma
 * @returns Ticket with flattened watchers and unified links array
 */
export function transformTicket(ticket: TicketWithRelations) {
  const { watchers, linkedFrom, linkedTo, ...rest } = ticket
  return {
    ...rest,
    watchers: watchers.map((w) => w.user),
    links: [
      ...linkedFrom.map((link) => ({
        id: link.id,
        linkType: link.linkType,
        linkedTicket: link.toTicket,
        direction: 'outward' as const,
      })),
      ...linkedTo.map((link) => ({
        id: link.id,
        linkType: link.linkType,
        linkedTicket: link.fromTicket,
        direction: 'inward' as const,
      })),
    ],
  }
}

/**
 * User select for admin listing with project count.
 */
export const USER_SELECT_ADMIN_LIST = {
  id: true,
  username: true,
  email: true,
  name: true,
  avatar: true,
  avatarColor: true,
  isSystemAdmin: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  _count: {
    select: { projects: true },
  },
} as const

/**
 * User select for created user response (excludes sensitive fields).
 */
export const USER_SELECT_CREATED = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  avatarColor: true,
  isSystemAdmin: true,
  isActive: true,
  createdAt: true,
} as const
