import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCurrentUser, useProjectMembers, DEMO_MEMBERS } from '../use-current-user'

describe('useCurrentUser', () => {
  it('should return demo user', () => {
    const { result } = renderHook(() => useCurrentUser())
    expect(result.current).toEqual({
      id: 'user-1',
      name: 'Demo User',
      email: 'demo@punt.local',
      avatar: null,
    })
  })
})

describe('useProjectMembers', () => {
  it('should return demo members', () => {
    const { result } = renderHook(() => useProjectMembers())
    expect(result.current).toEqual(DEMO_MEMBERS)
    expect(result.current).toHaveLength(4)
  })
})

