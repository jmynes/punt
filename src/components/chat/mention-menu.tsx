'use client'

import { HashIcon, UserIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface MentionItem {
  /** The value to insert (username for @, ticket key for #) */
  value: string
  /** Display label */
  label: string
  /** Secondary text (e.g., user name, ticket title) */
  description?: string
  /** Type of mention */
  type: 'user' | 'ticket'
}

interface MentionMenuProps {
  open: boolean
  items: MentionItem[]
  selectedIndex: number
  onSelect: (item: MentionItem) => void
  onSelectedIndexChange: (index: number) => void
}

export function MentionMenu({
  open,
  items,
  selectedIndex,
  onSelect,
  onSelectedIndexChange,
}: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current
    if (!menu || !open) return

    const selectedItem = menu.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, open])

  if (!open || items.length === 0) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-12 mb-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg z-50"
    >
      <div className="p-1">
        {items.map((item, index) => (
          <button
            key={`${item.type}-${item.value}`}
            type="button"
            data-index={index}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onSelectedIndexChange(index)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
            )}
          >
            {item.type === 'user' ? (
              <UserIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            ) : (
              <HashIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span
                className={cn(
                  'font-medium',
                  item.type === 'user' ? 'text-blue-400' : 'text-amber-400',
                )}
              >
                {item.type === 'user' ? `@${item.value}` : `#${item.value}`}
              </span>
              {item.description && (
                <span className="text-zinc-500 text-xs truncate">{item.description}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
