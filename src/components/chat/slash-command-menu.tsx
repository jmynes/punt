'use client'

import { useEffect, useRef } from 'react'
import { filterCommands, type SlashCommand } from '@/lib/chat/commands'
import { cn } from '@/lib/utils'

interface SlashCommandMenuProps {
  open: boolean
  filter: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
}

export function SlashCommandMenu({
  open,
  filter,
  onSelect,
  onClose: _onClose,
  selectedIndex,
  onSelectedIndexChange,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const commands = filterCommands(filter)

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current
    if (!menu || !open) return

    const selectedItem = menu.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, open])

  // Reset selection when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: onSelectedIndexChange is stable
  useEffect(() => {
    onSelectedIndexChange(0)
  }, [filter])

  if (!open || commands.length === 0) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-12 mb-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg z-50"
    >
      <div className="p-1">
        {commands.map((cmd, index) => (
          <button
            key={cmd.name}
            type="button"
            data-index={index}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => onSelectedIndexChange(index)}
            className={cn(
              'w-full flex flex-col items-start px-3 py-2 rounded-md text-left text-sm transition-colors',
              index === selectedIndex
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
            )}
          >
            <span className="font-medium text-purple-400">/{cmd.name}</span>
            <span className="text-zinc-500 text-xs">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
