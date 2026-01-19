'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarToggleIconProps {
  isOpen: boolean
  className?: string
}

/**
 * Animated sidebar toggle icon using lucide icons.
 * Shows PanelLeftClose when open (click to close), PanelLeftOpen when closed (click to open).
 */
export function SidebarToggleIcon({ isOpen, className }: SidebarToggleIconProps) {
  return (
    <div className={cn('relative flex h-5 w-5 items-center justify-center', className)}>
      <PanelLeftClose
        className={cn(
          'absolute h-5 w-5 transition-all duration-200',
          isOpen
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 -rotate-90 scale-75'
        )}
      />
      <PanelLeftOpen
        className={cn(
          'absolute h-5 w-5 transition-all duration-200',
          isOpen
            ? 'opacity-0 rotate-90 scale-75'
            : 'opacity-100 rotate-0 scale-100'
        )}
      />
    </div>
  )
}
