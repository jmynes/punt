import { describe, expect, it } from 'vitest'
import { ALL_PERMISSIONS } from '../constants'
import {
  DEFAULT_ROLE_NAMES,
  getDefaultRoleConfigs,
  getDefaultRolePermissions,
  isDefaultRoleName,
  mapLegacyRoleToDefaultName,
  ROLE_PRESETS,
} from '../presets'

describe('getDefaultRoleConfigs', () => {
  it('returns the three default roles with full config', () => {
    const configs = getDefaultRoleConfigs()
    expect(configs.map((c) => c.name)).toEqual(['Owner', 'Admin', 'Member'])
    for (const c of configs) {
      expect(c.isDefault).toBe(true)
      expect(typeof c.color).toBe('string')
      expect(typeof c.position).toBe('number')
    }
  })

  it('gives the Owner every permission and the Member only basic ones', () => {
    const configs = getDefaultRoleConfigs()
    const owner = configs.find((c) => c.name === 'Owner')!
    const member = configs.find((c) => c.name === 'Member')!
    expect(owner.permissions).toEqual([...ALL_PERMISSIONS])
    expect(member.permissions).toEqual(ROLE_PRESETS[DEFAULT_ROLE_NAMES.MEMBER])
    expect(member.permissions.length).toBeLessThan(owner.permissions.length)
  })
})

describe('getDefaultRolePermissions', () => {
  it('returns the preset for a known role and [] for an unknown one', () => {
    expect(getDefaultRolePermissions('Owner')).toEqual(ROLE_PRESETS.Owner)
    expect(getDefaultRolePermissions('Nonexistent')).toEqual([])
  })
})

describe('isDefaultRoleName', () => {
  it('recognizes default role names only', () => {
    expect(isDefaultRoleName('Admin')).toBe(true)
    expect(isDefaultRoleName('Custom')).toBe(false)
  })
})

describe('mapLegacyRoleToDefaultName', () => {
  it('maps legacy role strings (case-insensitive) with a Member fallback', () => {
    expect(mapLegacyRoleToDefaultName('owner')).toBe('Owner')
    expect(mapLegacyRoleToDefaultName('ADMIN')).toBe('Admin')
    expect(mapLegacyRoleToDefaultName('whatever')).toBe('Member')
  })
})
