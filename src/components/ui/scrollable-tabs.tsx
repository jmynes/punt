'use client'

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  href: string
  icon: React.ReactNode
}

interface ResponsiveTabsProps {
  tabs: TabItem[]
  activeValue: string
  className?: string
}

/**
 * Responsive tab navigation.
 *
 * - Desktop (sm+): horizontally scrollable tab bar with left/right arrow buttons
 *   that appear when tabs overflow (MUI-style).
 * - Mobile (<sm): dropdown button showing the active tab, full list in menu.
 */
export function ResponsiveTabs({ tabs, activeValue, className }: ResponsiveTabsProps) {
  const activeTab = tabs.find((t) => t.value === activeValue) ?? tabs[0]

  // Defer Radix dropdown to client to avoid hydration mismatch (server/client ID divergence)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Scroll state for desktop tabs
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Watch for resize and content changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: tabs is an intentional trigger to re-observe children
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollState()

    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    // Also observe children so adding/removing tabs triggers update
    for (const child of el.children) {
      observer.observe(child)
    }

    return () => observer.disconnect()
  }, [updateScrollState, tabs])

  // Scroll active tab into view on mount/tab change
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeValue is an intentional trigger
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeEl = el.querySelector('[data-active="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeValue])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const showArrows = canScrollLeft || canScrollRight

  return (
    <div className={className}>
      {/* Mobile: dropdown (client-only to avoid Radix hydration ID mismatch) */}
      <div className="sm:hidden">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {activeTab?.icon}
                  {activeTab?.label}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
              {tabs.map((tab) => (
                <DropdownMenuItem key={tab.value} asChild>
                  <Link
                    href={tab.href}
                    className={cn(
                      'flex items-center gap-2',
                      tab.value === activeValue && 'text-amber-500',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-100">
            <span className="flex items-center gap-2">
              {activeTab?.icon}
              {activeTab?.label}
            </span>
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </div>
        )}
      </div>

      {/* Desktop: scrollable tabs with arrow buttons */}
      <div className="hidden sm:flex sm:items-stretch border-b border-zinc-800">
        {/* Left arrow */}
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={cn(
              'flex items-center justify-center w-8 flex-shrink-0 transition-colors',
              canScrollLeft ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-700 cursor-default',
            )}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable tab container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          onWheel={(e) => {
            // Convert vertical scroll to horizontal
            if (e.deltaY !== 0 && scrollRef.current) {
              e.preventDefault()
              scrollRef.current.scrollLeft += e.deltaY
            }
          }}
          className="flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-none"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              data-active={tab.value === activeValue || undefined}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                tab.value === activeValue
                  ? 'text-amber-500 border-amber-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300',
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Right arrow */}
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={cn(
              'flex items-center justify-center w-8 flex-shrink-0 transition-colors',
              canScrollRight ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-700 cursor-default',
            )}
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
