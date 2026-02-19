'use client'

import { MessageSquareIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { useUIStore } from '@/stores/ui-store'

export function ChatFAB() {
  const { chatPanelOpen, toggleChatPanel } = useUIStore()
  const showChatPanel = useSettingsStore((s) => s.showChatPanel)

  if (!showChatPanel) {
    return null
  }

  return (
    <button
      type="button"
      onClick={toggleChatPanel}
      className={cn(
        'fixed bottom-14 right-4 z-40 flex h-14 w-14 items-center justify-center',
        'rounded-full bg-purple-600 shadow-lg transition-all',
        'hover:bg-purple-700 hover:scale-105',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
        chatPanelOpen && 'opacity-0 pointer-events-none',
      )}
      aria-label="Open Claude Chat"
    >
      <MessageSquareIcon className="h-6 w-6 text-white" />
    </button>
  )
}
