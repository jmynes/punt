'use client'

import { cn } from '@/lib/utils'

interface DropIndicatorProps {
  /** Number of items being dragged */
  itemCount?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Minimal drop indicator line for drag-and-drop.
 * A glowing line that shows where items will be inserted without causing reflow.
 */
export function DropIndicator({ itemCount: _itemCount = 1, className }: DropIndicatorProps) {
  return (
    <div
      className={cn(
        'relative h-0.5 -my-px',
        // Glow effect
        'before:absolute before:inset-0 before:-top-1 before:-bottom-1',
        'before:bg-emerald-500/30 before:blur-sm',
        className,
      )}
    >
      {/* Main line */}
      <div className="absolute inset-0 bg-emerald-500 rounded-full" />
      {/* Left dot */}
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      {/* Right dot */}
      <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
    </div>
  )
}

/**
 * Drop zone indicator for empty sections.
 * Shows when dragging over an empty sprint or backlog.
 */
export function DropZone({
  isActive,
  itemCount = 1,
  message,
  className,
}: {
  isActive: boolean
  itemCount?: number
  message?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed transition-all duration-300',
        'flex flex-col items-center justify-center py-10 gap-3',
        isActive
          ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[inset_0_0_30px_rgba(16,185,129,0.1)]'
          : 'border-zinc-700/50 bg-zinc-900/20',
        className,
      )}
    >
      {isActive ? (
        <>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <svg
              className="w-5 h-5 text-emerald-400 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
            </svg>
            <span className="text-sm font-semibold text-emerald-400">
              {itemCount > 1 ? `Drop ${itemCount} items here` : 'Drop here'}
            </span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <div
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"
              style={{ animationDelay: '0.2s' }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"
              style={{ animationDelay: '0.4s' }}
            />
          </div>
        </>
      ) : (
        <span className="text-sm text-zinc-500">{message || 'Drag tickets here'}</span>
      )}
    </div>
  )
}
