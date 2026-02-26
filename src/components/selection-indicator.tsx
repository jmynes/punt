'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useClearSelectionOnBlur } from '@/hooks/use-clear-selection-on-blur'
import { useSelectionStore } from '@/stores/selection-store'

/**
 * Floating selection indicator that appears when tickets are selected.
 * Shows the count of selected tickets with a clear button.
 * Works across both board and backlog views.
 */
export function SelectionIndicator() {
  const selectedTicketIds = useSelectionStore((state) => state.selectedTicketIds)
  const clearSelection = useSelectionStore((state) => state.clearSelection)

  // Clear selection when switching to another browser tab
  useClearSelectionOnBlur()

  const count = selectedTicketIds.size
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 pl-4 pr-2 py-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50">
        <span className="text-sm text-zinc-300 font-medium">
          {count} {count === 1 ? 'ticket' : 'tickets'} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-xs text-zinc-500 hidden sm:inline">Esc</span>
      </div>
    </div>
  )
}
