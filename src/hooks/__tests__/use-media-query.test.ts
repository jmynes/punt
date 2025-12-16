import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsDesktop, useIsMobile, useIsTablet, useMediaQuery } from '../use-media-query'

describe('useMediaQuery', () => {
  let matchMedia: (query: string) => MediaQueryList

  beforeEach(() => {
    matchMedia = vi.fn((query: string) => {
      const mediaQueryList = {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList

      return mediaQueryList
    })

    window.matchMedia = matchMedia
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return false when media query does not match', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('should return true when media query matches', () => {
    matchMedia = vi.fn((query: string) => {
      const mediaQueryList = {
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList

      return mediaQueryList
    })

    window.matchMedia = matchMedia

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('should update when media query changes', async () => {
    let matches = false
    const listeners: Array<(e: MediaQueryListEvent) => void> = []

    matchMedia = vi.fn((query: string) => {
      const mediaQueryList = {
        get matches() {
          return matches
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, listener: (e: MediaQueryListEvent) => void) => {
          listeners.push(listener)
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList

      return mediaQueryList
    })

    window.matchMedia = matchMedia

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)

    await act(async () => {
      matches = true
      listeners.forEach((listener) => {
        listener({ matches: true, media: '(max-width: 768px)' } as MediaQueryListEvent)
      })
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })
})

describe('useIsMobile', () => {
  it('should use mobile media query', () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBeDefined()
  })
})

describe('useIsTablet', () => {
  it('should use tablet media query', () => {
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBeDefined()
  })
})

describe('useIsDesktop', () => {
  it('should use desktop media query', () => {
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBeDefined()
  })
})
