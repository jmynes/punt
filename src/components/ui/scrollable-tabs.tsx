'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollableTabsProps {
  children: React.ReactNode
  className?: string
  activeValue?: string
}

/**
 * Wraps a horizontal tab bar with scroll overflow handling.
 * Shows subtle fade gradients on edges when content overflows,
 * with native horizontal scrolling (mouse wheel, trackpad, touch).
 * The scrollbar is visually hidden.
 */
export function ScrollableTabs({ children, className, activeValue }: ScrollableTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  // Scroll active tab into view without disturbing ancestor scroll containers
  const scrollActiveTabIntoView = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const activeTab = el.querySelector('[data-active]') as HTMLElement | null
    if (!activeTab) return

    const containerRect = el.getBoundingClientRect()
    const tabRect = activeTab.getBoundingClientRect()

    if (tabRect.left < containerRect.left) {
      el.scrollLeft -= containerRect.left - tabRect.left
    } else if (tabRect.right > containerRect.right) {
      el.scrollLeft += tabRect.right - containerRect.right
    }
  }, [])

  // Check scroll state on mount, scroll, and resize
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollState()

    el.addEventListener('scroll', updateScrollState, { passive: true })

    // Observe both the container (viewport resize) and its first child
    // (children added/removed, e.g. permission-gated tabs appearing)
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)
    const inner = el.firstElementChild
    if (inner) resizeObserver.observe(inner)

    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [updateScrollState])

  // Scroll active tab into view on mount and when active tab changes.
  // activeValue is an intentional trigger — when the user switches tabs,
  // the newly active tab needs to be scrolled into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeValue is an intentional trigger
  useEffect(() => {
    scrollActiveTabIntoView()
  }, [activeValue, scrollActiveTabIntoView])

  return (
    <div className={cn('relative', className)}>
      {/* Left fade gradient */}
      <div
        className={cn(
          'pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-150',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {/* Right fade gradient */}
      <div
        className={cn(
          'pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-150',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
