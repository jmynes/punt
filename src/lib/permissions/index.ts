/**
 * Permissions Module
 *
 * Re-exports permission constants, types, and presets.
 * Server-only modules (check.ts, create-default-roles.ts) are NOT re-exported
 * here because they import PrismaClient, which cannot be bundled for the browser.
 * Import those directly: '@/lib/permissions/check', '@/lib/permissions/create-default-roles'.
 */

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
