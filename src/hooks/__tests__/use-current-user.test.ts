import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useCurrentUser,
  useIsAuthenticated,
  useIsSystemAdmin,
  useProjectMembers,
} from '../use-current-user'

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: undefined }),
}))

import { useSession } from 'next-auth/react'

const mockUseSession = useSession as ReturnType<typeof vi.fn>

describe('useCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when not authenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const { result } = renderHook(() => useCurrentUser())
    expect(result.current).toBeNull()
  })

  it('should return null when loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    })

    const { result } = renderHook(() => useCurrentUser())
    expect(result.current).toBeNull()
  })

  it('should return user when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          username: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          avatar: '/avatar.jpg',
          isSystemAdmin: false,
        },
      },
      status: 'authenticated',
    })

    const { result } = renderHook(() => useCurrentUser())
    expect(result.current).toEqual({
      id: 'user-1',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatar: '/avatar.jpg',
      avatarColor: null,
      isSystemAdmin: false,
    })
  })
})

describe('useIsAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return isAuthenticated true when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
      status: 'authenticated',
    })

    const { result } = renderHook(() => useIsAuthenticated())
    expect(result.current).toEqual({
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('should return isLoading true when loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
    })

    const { result } = renderHook(() => useIsAuthenticated())
    expect(result.current).toEqual({
      isAuthenticated: false,
      isLoading: true,
    })
  })
})

describe('useIsSystemAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return isSystemAdmin true when user is admin', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', isSystemAdmin: true },
      },
      status: 'authenticated',
    })

    const { result } = renderHook(() => useIsSystemAdmin())
    expect(result.current).toEqual({
      isSystemAdmin: true,
      isLoading: false,
    })
  })

  it('should return isSystemAdmin false when user is not admin', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', isSystemAdmin: false },
      },
      status: 'authenticated',
    })

    const { result } = renderHook(() => useIsSystemAdmin())
    expect(result.current).toEqual({
      isSystemAdmin: false,
      isLoading: false,
    })
  })
})

describe('useProjectMembers', () => {
  it('should return empty array when no projectId provided (non-demo mode)', () => {
    const { result } = renderHook(() => useProjectMembers())
    // Without projectId, query is disabled and returns empty array
    expect(result.current).toEqual([])
  })
})
