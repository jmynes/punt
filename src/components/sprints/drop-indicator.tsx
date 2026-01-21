'use client'

import { cn } from '@/lib/utils'

interface DropIndicatorProps {
  /** Number of items being dragged */
  itemCount?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Bold, unmistakable drop indicator for drag-and-drop.
 * Creates an animated "slot" that clearly shows where items will be inserted.
 */
export function DropIndicator({ itemCount = 1, className }: DropIndicatorProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        // Generous height to make it unmistakable
        'h-12 my-1',
        // Animated entrance
        'animate-in slide-in-from-left-2 fade-in-0 duration-200',
        className,
      )}
    >
      {/* Background glow effect */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg',
          'bg-gradient-to-r from-emerald-500/20 via-emerald-400/30 to-emerald-500/20',
          'animate-pulse',
        )}
      />

      {/* Animated border container */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg',
          'border-2 border-dashed border-emerald-500/70',
          'bg-emerald-500/5',
        )}
      />

      {/* Left chevron indicator */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-emerald-500" />
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/90 shadow-lg shadow-emerald-500/30">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
          </svg>
          <span className="text-sm font-semibold text-white tracking-wide">
            {itemCount > 1 ? `Drop ${itemCount} items here` : 'Drop here'}
          </span>
        </div>
      </div>

      {/* Right chevron indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-emerald-500" />
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
      </div>

      {/* Scanning line animation */}
      <div
        className={cn(
          'absolute top-0 left-0 w-full h-full',
          'bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent',
          'animate-[scan_1.5s_ease-in-out_infinite]',
        )}
        style={{
          backgroundSize: '200% 100%',
        }}
      />
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
