import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSIONS,
  CATEGORY_METADATA,
  getPermissionsByCategory,
  getSortedCategoriesWithPermissions,
  isValidPermission,
  PERMISSION_CATEGORIES,
  PERMISSION_METADATA,
  PERMISSIONS,
  parsePermissions,
} from '../constants'

describe('Permission Constants', () => {
  describe('PERMISSIONS', () => {
    it('should have 13 defined permissions', () => {
      expect(Object.keys(PERMISSIONS)).toHaveLength(13)
    })

    it('should have correct permission string format', () => {
      for (const permission of Object.values(PERMISSIONS)) {
        expect(permission).toMatch(/^[a-z]+\.[a-z_]+$/)
      }
    })

    it('should have all expected permissions', () => {
      expect(PERMISSIONS.PROJECT_SETTINGS).toBe('project.settings')
      expect(PERMISSIONS.PROJECT_DELETE).toBe('project.delete')
      expect(PERMISSIONS.MEMBERS_INVITE).toBe('members.invite')
      expect(PERMISSIONS.MEMBERS_MANAGE).toBe('members.manage')
      expect(PERMISSIONS.MEMBERS_ADMIN).toBe('members.admin')
      expect(PERMISSIONS.BOARD_MANAGE).toBe('board.manage')
      expect(PERMISSIONS.TICKETS_CREATE).toBe('tickets.create')
      expect(PERMISSIONS.TICKETS_MANAGE_OWN).toBe('tickets.manage_own')
      expect(PERMISSIONS.TICKETS_MANAGE_ANY).toBe('tickets.manage_any')
      expect(PERMISSIONS.SPRINTS_MANAGE).toBe('sprints.manage')
      expect(PERMISSIONS.LABELS_MANAGE).toBe('labels.manage')
      expect(PERMISSIONS.COMMENTS_MANAGE_ANY).toBe('comments.manage_any')
      expect(PERMISSIONS.ATTACHMENTS_MANAGE_ANY).toBe('attachments.manage_any')
    })
  })

  describe('ALL_PERMISSIONS', () => {
    it('should be an array of all permission values', () => {
      expect(ALL_PERMISSIONS).toHaveLength(13)
      expect(ALL_PERMISSIONS).toContain(PERMISSIONS.TICKETS_CREATE)
      expect(ALL_PERMISSIONS).toContain(PERMISSIONS.PROJECT_DELETE)
    })

    it('should match Object.values of PERMISSIONS', () => {
      expect(ALL_PERMISSIONS).toEqual(Object.values(PERMISSIONS))
    })
  })

  describe('PERMISSION_CATEGORIES', () => {
    it('should have 7 categories', () => {
      expect(Object.keys(PERMISSION_CATEGORIES)).toHaveLength(7)
    })

    it('should have all expected categories', () => {
      expect(PERMISSION_CATEGORIES.PROJECT).toBe('project')
      expect(PERMISSION_CATEGORIES.MEMBERS).toBe('members')
      expect(PERMISSION_CATEGORIES.BOARD).toBe('board')
      expect(PERMISSION_CATEGORIES.TICKETS).toBe('tickets')
      expect(PERMISSION_CATEGORIES.SPRINTS).toBe('sprints')
      expect(PERMISSION_CATEGORIES.LABELS).toBe('labels')
      expect(PERMISSION_CATEGORIES.MODERATION).toBe('moderation')
    })
  })

  describe('PERMISSION_METADATA', () => {
    it('should have metadata for all permissions', () => {
      for (const permission of ALL_PERMISSIONS) {
        expect(PERMISSION_METADATA[permission]).toBeDefined()
        expect(PERMISSION_METADATA[permission].key).toBe(permission)
        expect(PERMISSION_METADATA[permission].label).toBeTruthy()
        expect(PERMISSION_METADATA[permission].description).toBeTruthy()
        expect(PERMISSION_METADATA[permission].category).toBeTruthy()
      }
    })

    it('should have valid category references', () => {
      const validCategories = Object.values(PERMISSION_CATEGORIES)
      for (const permission of ALL_PERMISSIONS) {
        expect(validCategories).toContain(PERMISSION_METADATA[permission].category)
      }
    })
  })

  describe('CATEGORY_METADATA', () => {
    it('should have metadata for all categories', () => {
      for (const category of Object.values(PERMISSION_CATEGORIES)) {
        expect(CATEGORY_METADATA[category]).toBeDefined()
        expect(CATEGORY_METADATA[category].key).toBe(category)
        expect(CATEGORY_METADATA[category].label).toBeTruthy()
        expect(CATEGORY_METADATA[category].description).toBeTruthy()
        expect(typeof CATEGORY_METADATA[category].order).toBe('number')
      }
    })

    it('should have unique order values', () => {
      const orders = Object.values(CATEGORY_METADATA).map((m) => m.order)
      const uniqueOrders = new Set(orders)
      expect(uniqueOrders.size).toBe(orders.length)
    })
  })

  describe('isValidPermission', () => {
    it('should return true for valid permissions', () => {
      expect(isValidPermission('tickets.create')).toBe(true)
      expect(isValidPermission('project.delete')).toBe(true)
      expect(isValidPermission('members.admin')).toBe(true)
    })

    it('should return false for invalid permissions', () => {
      expect(isValidPermission('invalid.permission')).toBe(false)
      expect(isValidPermission('tickets')).toBe(false)
      expect(isValidPermission('')).toBe(false)
      expect(isValidPermission('TICKETS.CREATE')).toBe(false) // Case sensitive
    })
  })

  describe('parsePermissions', () => {
    it('should return empty array for null', () => {
      expect(parsePermissions(null)).toEqual([])
    })

    it('should return empty array for empty string', () => {
      expect(parsePermissions('')).toEqual([])
    })

    it('should parse valid JSON array of permissions', () => {
      const json = JSON.stringify(['tickets.create', 'labels.manage'])
      const result = parsePermissions(json)
      expect(result).toHaveLength(2)
      expect(result).toContain('tickets.create')
      expect(result).toContain('labels.manage')
    })

    it('should filter out invalid permissions', () => {
      const json = JSON.stringify(['tickets.create', 'invalid.perm', 'labels.manage'])
      const result = parsePermissions(json)
      expect(result).toHaveLength(2)
      expect(result).not.toContain('invalid.perm')
    })

    it('should return empty array for invalid JSON', () => {
      expect(parsePermissions('not json')).toEqual([])
      expect(parsePermissions('{invalid}')).toEqual([])
      expect(parsePermissions('["unclosed')).toEqual([])
    })

    it('should return empty array for non-array JSON', () => {
      expect(parsePermissions('{"key": "value"}')).toEqual([])
      expect(parsePermissions('"string"')).toEqual([])
      expect(parsePermissions('123')).toEqual([])
    })

    it('should handle empty array', () => {
      expect(parsePermissions('[]')).toEqual([])
    })

    it('should handle array with only invalid permissions', () => {
      const json = JSON.stringify(['invalid1', 'invalid2'])
      expect(parsePermissions(json)).toEqual([])
    })
  })

  describe('getPermissionsByCategory', () => {
    it('should return permissions grouped by category', () => {
      const grouped = getPermissionsByCategory()

      expect(Object.keys(grouped)).toHaveLength(7)
      expect(grouped.project).toBeDefined()
      expect(grouped.members).toBeDefined()
      expect(grouped.tickets).toBeDefined()
    })

    it('should have project permissions in project category', () => {
      const grouped = getPermissionsByCategory()
      const projectPermissions = grouped.project.map((p) => p.key)

      expect(projectPermissions).toContain('project.settings')
      expect(projectPermissions).toContain('project.delete')
    })

    it('should have ticket permissions in tickets category', () => {
      const grouped = getPermissionsByCategory()
      const ticketPermissions = grouped.tickets.map((p) => p.key)

      expect(ticketPermissions).toContain('tickets.create')
      expect(ticketPermissions).toContain('tickets.manage_own')
      expect(ticketPermissions).toContain('tickets.manage_any')
    })

    it('should include all permissions across all categories', () => {
      const grouped = getPermissionsByCategory()
      const allGroupedPermissions = Object.values(grouped)
        .flat()
        .map((p) => p.key)

      expect(allGroupedPermissions).toHaveLength(ALL_PERMISSIONS.length)
      for (const permission of ALL_PERMISSIONS) {
        expect(allGroupedPermissions).toContain(permission)
      }
    })
  })

  describe('getSortedCategoriesWithPermissions', () => {
    it('should return categories sorted by order', () => {
      const sorted = getSortedCategoriesWithPermissions()

      expect(sorted).toHaveLength(7)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].category.order).toBeGreaterThan(sorted[i - 1].category.order)
      }
    })

    it('should have project category first', () => {
      const sorted = getSortedCategoriesWithPermissions()
      expect(sorted[0].category.key).toBe('project')
    })

    it('should include permissions with each category', () => {
      const sorted = getSortedCategoriesWithPermissions()

      for (const entry of sorted) {
        expect(entry.permissions).toBeDefined()
        expect(Array.isArray(entry.permissions)).toBe(true)
        for (const perm of entry.permissions) {
          expect(perm.category).toBe(entry.category.key)
        }
      }
    })
  })
})
