/**
 * Permissions Module
 *
 * Re-exports all permission-related utilities and constants.
 */

// Permission checking
export {
  canAssignRole,
  canManageMember,
  type EffectivePermissions,
  getEffectivePermissions,
  getRolePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isMember,
  type MembershipWithRole,
} from './check'
// Constants and types
export {
  ALL_PERMISSIONS,
  CATEGORY_METADATA,
  type CategoryMeta,
  getPermissionsByCategory,
  getSortedCategoriesWithPermissions,
  isValidPermission,
  PERMISSION_CATEGORIES,
  PERMISSION_METADATA,
  PERMISSIONS,
  type Permission,
  type PermissionCategory,
  type PermissionMeta,
  parsePermissions,
} from './constants'
// Role creation helpers
export {
  createDefaultRolesForProject,
  getMemberRoleForProject,
  getOwnerRoleForProject,
  getRoleByName,
} from './create-default-roles'
// Role presets
export {
  DEFAULT_ROLE_NAMES,
  type DefaultRoleConfig,
  type DefaultRoleName,
  getDefaultRoleConfigs,
  getDefaultRolePermissions,
  isDefaultRoleName,
  mapLegacyRoleToDefaultName,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_POSITIONS,
  ROLE_PRESETS,
} from './presets'
