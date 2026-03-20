'use client'

import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface KebabAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

interface KebabMenuProps {
  actions: (KebabAction | null | undefined)[]
  align?: 'start' | 'end'
  triggerClassName?: string
  onCloseAutoFocus?: (e: Event) => void
}

export function KebabMenu({
  actions,
  align = 'end',
  triggerClassName,
  onCloseAutoFocus = (e) => e.preventDefault(),
}: KebabMenuProps) {
  const filteredActions = actions.filter(Boolean) as KebabAction[]

  if (filteredActions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn('text-zinc-500 hover:text-zinc-200', triggerClassName)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onCloseAutoFocus={onCloseAutoFocus}>
        {filteredActions.map((action, idx) => (
          <span key={action.label}>
            {idx > 0 &&
              action.variant === 'destructive' &&
              filteredActions[idx - 1]?.variant !== 'destructive' && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                if (action.disabled) return
                action.onClick()
              }}
              disabled={action.disabled}
              className={cn(action.variant === 'destructive' && 'text-red-400 focus:text-red-400')}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
