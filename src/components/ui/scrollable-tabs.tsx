'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
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
 * - Desktop (sm+): horizontal flex-wrap — all tabs visible, wraps to second row if needed.
 * - Mobile (<sm): dropdown button showing the active tab, full list in menu.
 */
export function ResponsiveTabs({ tabs, activeValue, className }: ResponsiveTabsProps) {
  const activeTab = tabs.find((t) => t.value === activeValue) ?? tabs[0]

  // Defer Radix dropdown to client to avoid hydration mismatch (server/client ID divergence)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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

      {/* Desktop: wrapping horizontal tabs */}
      <div className="hidden sm:flex sm:flex-wrap sm:gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
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
    </div>
  )
}
