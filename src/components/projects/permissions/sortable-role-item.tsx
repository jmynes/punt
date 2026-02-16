'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RoleItemAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

export interface EditorRole {
  id: string
  name: string
  color: string
  description: string
  isDefault: boolean
  /** Optional subtitle (e.g. "3 members") shown below the name */
  subtitle?: string
}

interface SortableRoleItemProps {
  role: EditorRole
  isSelected: boolean
  isCreating?: boolean
  canReorder?: boolean
  onSelect: () => void
  actions?: RoleItemAction[]
}

export function SortableRoleItem({
  role,
  isSelected,
  isCreating = false,
  canReorder = false,
  onSelect,
  actions,
}: SortableRoleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
    disabled: !canReorder,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-md transition-colors',
        isDragging && 'z-50 bg-zinc-700 shadow-lg ring-1 ring-amber-500/50',
        isSelected && !isCreating ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
      )}
    >
      {canReorder && (
        <button
          type="button"
          className="ml-1 cursor-grab touch-none text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex-1 flex items-center gap-3 px-3 py-2 text-left transition-colors min-w-0',
          !canReorder && 'pl-3',
          isSelected && !isCreating ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: role.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{role.name}</span>
            {role.isDefault && <Lock className="h-3 w-3 text-zinc-600 flex-shrink-0" />}
          </div>
          {role.subtitle && (
            <div className="text-xs text-zinc-500">
              <span>{role.subtitle}</span>
            </div>
          )}
        </div>
      </button>
      {actions && actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 mr-1 text-zinc-500 hover:text-zinc-200"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            {actions.map((action, idx) => (
              <span key={action.label}>
                {idx > 0 &&
                  action.variant === 'destructive' &&
                  actions[idx - 1]?.variant !== 'destructive' && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    if (action.disabled) return
                    action.onClick()
                  }}
                  disabled={action.disabled}
                  className={cn(
                    action.variant === 'destructive' && 'text-red-400 focus:text-red-400',
                  )}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </DropdownMenuItem>
              </span>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
