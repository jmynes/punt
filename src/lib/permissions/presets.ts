/**
 * Default Role Presets
 *
 * Defines the default roles created for each project and their
 * associated permissions. These roles have `isDefault: true` and
 * cannot be deleted.
 */

import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from './constants'

// Role name constants
export const DEFAULT_ROLE_NAMES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
} as const

export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[keyof typeof DEFAULT_ROLE_NAMES]

// Role colors for UI badges
export const ROLE_COLORS = {
  [DEFAULT_ROLE_NAMES.OWNER]: '#f59e0b', // amber-500
  [DEFAULT_ROLE_NAMES.ADMIN]: '#3b82f6', // blue-500
  [DEFAULT_ROLE_NAMES.MEMBER]: '#6b7280', // gray-500
} as const

// Role descriptions
export const ROLE_DESCRIPTIONS = {
  [DEFAULT_ROLE_NAMES.OWNER]:
    'Full control over the project including deletion and permission management',
  [DEFAULT_ROLE_NAMES.ADMIN]: 'Can manage most project settings, members, and content',
  [DEFAULT_ROLE_NAMES.MEMBER]: 'Can create tickets and manage their own content',
} as const

// Default permission sets for each role
export const ROLE_PRESETS: Record<DefaultRoleName, Permission[]> = {
  // Owner: All permissions
  [DEFAULT_ROLE_NAMES.OWNER]: [...ALL_PERMISSIONS],

  // Admin: All except project deletion and permission administration
  [DEFAULT_ROLE_NAMES.ADMIN]: [
    PERMISSIONS.PROJECT_SETTINGS,
    // No PROJECT_DELETE
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_MANAGE,
    // No MEMBERS_ADMIN
    PERMISSIONS.BOARD_MANAGE,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_MANAGE_OWN,
    PERMISSIONS.TICKETS_MANAGE_ANY,
    PERMISSIONS.SPRINTS_MANAGE,
    PERMISSIONS.LABELS_MANAGE,
    PERMISSIONS.COMMENTS_MANAGE_ANY,
    PERMISSIONS.ATTACHMENTS_MANAGE_ANY,
  ],

  // Member: Basic ticket creation and own content management
  [DEFAULT_ROLE_NAMES.MEMBER]: [PERMISSIONS.TICKETS_CREATE, PERMISSIONS.TICKETS_MANAGE_OWN],
}

// Position/hierarchy of default roles (lower = higher rank)
export const ROLE_POSITIONS: Record<DefaultRoleName, number> = {
  [DEFAULT_ROLE_NAMES.OWNER]: 0,
  [DEFAULT_ROLE_NAMES.ADMIN]: 1,
  [DEFAULT_ROLE_NAMES.MEMBER]: 2,
}

// Get the default role configuration for creating roles
export interface DefaultRoleConfig {
  name: DefaultRoleName
  color: string
  description: string
  permissions: Permission[]
  position: number
  isDefault: true
}

export function getDefaultRoleConfigs(): DefaultRoleConfig[] {
  return Object.values(DEFAULT_ROLE_NAMES).map((name) => ({
    name,
    color: ROLE_COLORS[name],
    description: ROLE_DESCRIPTIONS[name],
    permissions: ROLE_PRESETS[name],
    position: ROLE_POSITIONS[name],
    isDefault: true as const,
  }))
}

// Get a specific default role's permissions
export function getDefaultRolePermissions(roleName: string): Permission[] {
  if (roleName in ROLE_PRESETS) {
    return ROLE_PRESETS[roleName as DefaultRoleName]
  }
  // Unknown role name defaults to no permissions
  return []
}

// Check if a role name is a default role
export function isDefaultRoleName(name: string): name is DefaultRoleName {
  return Object.values(DEFAULT_ROLE_NAMES).includes(name as DefaultRoleName)
}

// Map old role string (owner/admin/member) to default role name
export function mapLegacyRoleToDefaultName(legacyRole: string): DefaultRoleName {
  switch (legacyRole.toLowerCase()) {
    case 'owner':
      return DEFAULT_ROLE_NAMES.OWNER
    case 'admin':
      return DEFAULT_ROLE_NAMES.ADMIN
    default:
      return DEFAULT_ROLE_NAMES.MEMBER
  }
}
