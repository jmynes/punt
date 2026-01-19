'use client'

import { cn } from '@/lib/utils'

interface AnimatedMenuIconProps {
  isOpen: boolean
  className?: string
}

/**
 * Animated hamburger menu icon that morphs into an X when open.
 * Uses CSS transitions for a smooth, satisfying micro-interaction.
 */
export function AnimatedMenuIcon({ isOpen, className }: AnimatedMenuIconProps) {
  return (
    <div className={cn('relative flex h-5 w-5 flex-col items-center justify-center', className)}>
      {/* Top line - rotates to form top half of X */}
      <span
        className={cn(
          'absolute h-[2px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]',
          isOpen ? 'translate-y-0 rotate-45' : '-translate-y-[5px] rotate-0',
        )}
      />
      {/* Middle line - fades out */}
      <span
        className={cn(
          'absolute h-[2px] w-4 rounded-full bg-current transition-all duration-200',
          isOpen ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100',
        )}
      />
      {/* Bottom line - rotates to form bottom half of X */}
      <span
        className={cn(
          'absolute h-[2px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]',
          isOpen ? 'translate-y-0 -rotate-45' : 'translate-y-[5px] rotate-0',
        )}
      />
    </div>
  )
}
