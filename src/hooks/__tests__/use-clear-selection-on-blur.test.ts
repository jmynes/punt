import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSelectionStore } from '@/stores/selection-store'
import { useClearSelectionOnBlur } from '../use-clear-selection-on-blur'

describe('useClearSelectionOnBlur', () => {
  let visibilityState: DocumentVisibilityState
  let visibilityListeners: Array<() => void>

  beforeEach(() => {
    // Reset store state before each test
    useSelectionStore.setState({
      selectedTicketIds: new Set(),
      lastSelectedId: null,
      ticketOrigins: new Map(),
      copiedTicketIds: [],
    })

    visibilityState = 'visible'
    visibilityListeners = []

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })

    // Mock addEventListener/removeEventListener for visibilitychange
    vi.spyOn(document, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'visibilitychange') {
        visibilityListeners.push(listener as () => void)
      }
    })

    vi.spyOn(document, 'removeEventListener').mockImplementation((event, listener) => {
      if (event === 'visibilitychange') {
        const index = visibilityListeners.indexOf(listener as () => void)
        if (index > -1) {
          visibilityListeners.splice(index, 1)
        }
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should add visibilitychange event listener on mount', () => {
    renderHook(() => useClearSelectionOnBlur())

    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('should remove visibilitychange event listener on unmount', () => {
    const { unmount } = renderHook(() => useClearSelectionOnBlur())

    unmount()

    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
  })

  it('should clear selection when document becomes hidden', () => {
    // Set up some selected tickets
    useSelectionStore.getState().selectTicket('ticket-1')
    useSelectionStore.getState().addToSelection(['ticket-2', 'ticket-3'])
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(3)

    renderHook(() => useClearSelectionOnBlur())

    // Simulate tab switch (document becomes hidden)
    act(() => {
      visibilityState = 'hidden'
      for (const listener of visibilityListeners) {
        listener()
      }
    })

    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(0)
    expect(useSelectionStore.getState().lastSelectedId).toBe(null)
  })

  it('should not clear selection when document becomes visible', () => {
    // Start with hidden state
    visibilityState = 'hidden'

    // Set up some selected tickets
    useSelectionStore.getState().selectTicket('ticket-1')
    useSelectionStore.getState().addToSelection(['ticket-2'])
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(2)

    renderHook(() => useClearSelectionOnBlur())

    // Simulate returning to tab (document becomes visible)
    act(() => {
      visibilityState = 'visible'
      for (const listener of visibilityListeners) {
        listener()
      }
    })

    // Selection should remain unchanged
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(2)
  })

  it('should handle multiple visibility changes', () => {
    renderHook(() => useClearSelectionOnBlur())

    // Select tickets
    act(() => {
      useSelectionStore.getState().selectTicket('ticket-1')
    })
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(1)

    // First tab switch (hide)
    act(() => {
      visibilityState = 'hidden'
      for (const listener of visibilityListeners) {
        listener()
      }
    })
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(0)

    // Return to tab
    act(() => {
      visibilityState = 'visible'
      for (const listener of visibilityListeners) {
        listener()
      }
    })

    // Select more tickets
    act(() => {
      useSelectionStore.getState().selectTicket('ticket-2')
      useSelectionStore.getState().addToSelection(['ticket-3'])
    })
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(2)

    // Second tab switch (hide)
    act(() => {
      visibilityState = 'hidden'
      for (const listener of visibilityListeners) {
        listener()
      }
    })
    expect(useSelectionStore.getState().selectedTicketIds.size).toBe(0)
  })
})
