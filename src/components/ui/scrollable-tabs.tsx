'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollableTabsProps {
  children: React.ReactNode
  className?: string
  activeValue?: string
}

const SCROLL_AMOUNT = 150

/**
 * Wraps a horizontal tab bar with scroll overflow handling.
 * Shows arrow buttons and fade gradients on edges when content overflows,
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

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({
      left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: 'smooth',
    })
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

  const hasOverflow = canScrollLeft || canScrollRight

  return (
    <div className={cn('relative', className)}>
      {/* Left arrow button + fade gradient */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity duration-150',
          canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <button
          type="button"
          onClick={() => scrollBy('left')}
          className="flex h-full items-center px-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Scroll tabs left"
          tabIndex={canScrollLeft ? 0 : -1}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          hasOverflow && 'px-6',
        )}
      >
        {children}
      </div>

      {/* Right arrow button + fade gradient */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity duration-150',
          canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <button
          type="button"
          onClick={() => scrollBy('right')}
          className="flex h-full items-center px-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Scroll tabs right"
          tabIndex={canScrollRight ? 0 : -1}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
