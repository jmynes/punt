/**
 * Granular Permission System Constants
 *
 * This module defines all available permissions, their metadata,
 * and category groupings for the role-based access control system.
 */

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES = {
  PROJECT: 'project',
  MEMBERS: 'members',
  BOARD: 'board',
  TICKETS: 'tickets',
  SPRINTS: 'sprints',
  LABELS: 'labels',
  MODERATION: 'moderation',
} as const

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[keyof typeof PERMISSION_CATEGORIES]

// All available permissions
export const PERMISSIONS = {
  // Project Management
  PROJECT_SETTINGS: 'project.settings',
  PROJECT_DELETE: 'project.delete',

  // Member Management
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_MANAGE: 'members.manage',
  MEMBERS_ADMIN: 'members.admin',

  // Board/Column Management
  BOARD_MANAGE: 'board.manage',

  // Ticket Management
  TICKETS_CREATE: 'tickets.create',
  TICKETS_MANAGE_OWN: 'tickets.manage_own',
  TICKETS_MANAGE_ANY: 'tickets.manage_any',

  // Sprint Management
  SPRINTS_MANAGE: 'sprints.manage',

  // Label Management
  LABELS_MANAGE: 'labels.manage',

  // Moderation (comments & attachments)
  COMMENTS_MANAGE_ANY: 'comments.manage_any',
  ATTACHMENTS_MANAGE_ANY: 'attachments.manage_any',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Array of all permission values for validation
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[]

// Permission metadata for UI display
export interface PermissionMeta {
  key: Permission
  label: string
  description: string
  category: PermissionCategory
}

export const PERMISSION_METADATA: Record<Permission, PermissionMeta> = {
  // Project
  [PERMISSIONS.PROJECT_SETTINGS]: {
    key: PERMISSIONS.PROJECT_SETTINGS,
    label: 'Edit project settings',
    description: 'Modify project name, description, and color',
    category: PERMISSION_CATEGORIES.PROJECT,
  },
  [PERMISSIONS.PROJECT_DELETE]: {
    key: PERMISSIONS.PROJECT_DELETE,
    label: 'Delete project',
    description: 'Permanently delete the project and all its data',
    category: PERMISSION_CATEGORIES.PROJECT,
  },

  // Members
  [PERMISSIONS.MEMBERS_INVITE]: {
    key: PERMISSIONS.MEMBERS_INVITE,
    label: 'Invite members',
    description: 'Send invitations to new project members',
    category: PERMISSION_CATEGORIES.MEMBERS,
  },
  [PERMISSIONS.MEMBERS_MANAGE]: {
    key: PERMISSIONS.MEMBERS_MANAGE,
    label: 'Manage members',
    description: 'Remove members and change their roles',
    category: PERMISSION_CATEGORIES.MEMBERS,
  },
  [PERMISSIONS.MEMBERS_ADMIN]: {
    key: PERMISSIONS.MEMBERS_ADMIN,
    label: 'Administer permissions',
    description: 'Create and edit custom roles, manage member permissions',
    category: PERMISSION_CATEGORIES.MEMBERS,
  },

  // Board
  [PERMISSIONS.BOARD_MANAGE]: {
    key: PERMISSIONS.BOARD_MANAGE,
    label: 'Manage columns',
    description: 'Create, edit, delete, and reorder board columns',
    category: PERMISSION_CATEGORIES.BOARD,
  },

  // Tickets
  [PERMISSIONS.TICKETS_CREATE]: {
    key: PERMISSIONS.TICKETS_CREATE,
    label: 'Create tickets',
    description: 'Create new tickets in the project',
    category: PERMISSION_CATEGORIES.TICKETS,
  },
  [PERMISSIONS.TICKETS_MANAGE_OWN]: {
    key: PERMISSIONS.TICKETS_MANAGE_OWN,
    label: 'Manage own tickets',
    description: 'Edit and delete tickets you created',
    category: PERMISSION_CATEGORIES.TICKETS,
  },
  [PERMISSIONS.TICKETS_MANAGE_ANY]: {
    key: PERMISSIONS.TICKETS_MANAGE_ANY,
    label: 'Manage any ticket',
    description: 'Edit and delete any ticket, assign tickets, bulk operations',
    category: PERMISSION_CATEGORIES.TICKETS,
  },

  // Sprints
  [PERMISSIONS.SPRINTS_MANAGE]: {
    key: PERMISSIONS.SPRINTS_MANAGE,
    label: 'Manage sprints',
    description: 'Create, start, complete, edit, and delete sprints',
    category: PERMISSION_CATEGORIES.SPRINTS,
  },

  // Labels
  [PERMISSIONS.LABELS_MANAGE]: {
    key: PERMISSIONS.LABELS_MANAGE,
    label: 'Manage labels',
    description: 'Create, edit, and delete project labels',
    category: PERMISSION_CATEGORIES.LABELS,
  },

  // Moderation
  [PERMISSIONS.COMMENTS_MANAGE_ANY]: {
    key: PERMISSIONS.COMMENTS_MANAGE_ANY,
    label: 'Moderate comments',
    description: 'Edit and delete any comment',
    category: PERMISSION_CATEGORIES.MODERATION,
  },
  [PERMISSIONS.ATTACHMENTS_MANAGE_ANY]: {
    key: PERMISSIONS.ATTACHMENTS_MANAGE_ANY,
    label: 'Moderate attachments',
    description: 'Delete any attachment',
    category: PERMISSION_CATEGORIES.MODERATION,
  },
}

// Category metadata for UI display
export interface CategoryMeta {
  key: PermissionCategory
  label: string
  description: string
  order: number
}

export const CATEGORY_METADATA: Record<PermissionCategory, CategoryMeta> = {
  [PERMISSION_CATEGORIES.PROJECT]: {
    key: PERMISSION_CATEGORIES.PROJECT,
    label: 'Project',
    description: 'Project-level settings and management',
    order: 1,
  },
  [PERMISSION_CATEGORIES.MEMBERS]: {
    key: PERMISSION_CATEGORIES.MEMBERS,
    label: 'Members',
    description: 'Member and role management',
    order: 2,
  },
  [PERMISSION_CATEGORIES.BOARD]: {
    key: PERMISSION_CATEGORIES.BOARD,
    label: 'Board',
    description: 'Kanban board and column management',
    order: 3,
  },
  [PERMISSION_CATEGORIES.TICKETS]: {
    key: PERMISSION_CATEGORIES.TICKETS,
    label: 'Tickets',
    description: 'Ticket creation and management',
    order: 4,
  },
  [PERMISSION_CATEGORIES.SPRINTS]: {
    key: PERMISSION_CATEGORIES.SPRINTS,
    label: 'Sprints',
    description: 'Sprint planning and execution',
    order: 5,
  },
  [PERMISSION_CATEGORIES.LABELS]: {
    key: PERMISSION_CATEGORIES.LABELS,
    label: 'Labels',
    description: 'Project label management',
    order: 6,
  },
  [PERMISSION_CATEGORIES.MODERATION]: {
    key: PERMISSION_CATEGORIES.MODERATION,
    label: 'Moderation',
    description: 'Content moderation for comments and attachments',
    order: 7,
  },
}

// Get permissions grouped by category
export function getPermissionsByCategory(): Record<PermissionCategory, PermissionMeta[]> {
  const grouped = {} as Record<PermissionCategory, PermissionMeta[]>

  for (const category of Object.values(PERMISSION_CATEGORIES)) {
    grouped[category] = []
  }

  for (const meta of Object.values(PERMISSION_METADATA)) {
    grouped[meta.category].push(meta)
  }

  return grouped
}

// Get sorted categories with their permissions
export function getSortedCategoriesWithPermissions(): Array<{
  category: CategoryMeta
  permissions: PermissionMeta[]
}> {
  const permissionsByCategory = getPermissionsByCategory()

  return Object.values(CATEGORY_METADATA)
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      category,
      permissions: permissionsByCategory[category.key],
    }))
}

// Validate if a string is a valid permission
export function isValidPermission(value: string): value is Permission {
  return ALL_PERMISSIONS.includes(value as Permission)
}

// Maximum size for permission JSON to prevent memory exhaustion attacks
const MAX_PERMISSIONS_JSON_SIZE = 10_000 // 10KB should be plenty for permissions

// Parse and validate a permissions array from JSON
export function parsePermissions(json: string | null): Permission[] {
  if (!json) return []
  // Security: Prevent memory exhaustion from oversized JSON
  if (json.length > MAX_PERMISSIONS_JSON_SIZE) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPermission)
  } catch {
    return []
  }
}
