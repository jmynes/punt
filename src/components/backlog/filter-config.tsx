'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowUp,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Columns,
  Eye,
  EyeOff,
  Flag,
  GripVertical,
  Hash,
  Layers,
  RotateCcw,
  User,
  Zap,
} from 'lucide-react'
import type * as React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { type FilterButton, type FilterButtonId, useBacklogStore } from '@/stores/backlog-store'

// Icons for each filter button type
const filterButtonIcons: Record<FilterButtonId, React.ComponentType<{ className?: string }>> = {
  type: CheckSquare,
  status: Zap,
  resolution: CheckCircle2,
  priority: ArrowUp,
  assignee: User,
  labels: Layers,
  sprint: Flag,
  storyPoints: Hash,
  dueDate: Calendar,
}

const filterButtonColors: Record<FilterButtonId, string> = {
  type: 'text-blue-400',
  status: 'text-cyan-400',
  resolution: 'text-green-400',
  priority: 'text-blue-400',
  assignee: 'text-zinc-400',
  labels: 'text-purple-400',
  sprint: 'text-amber-400',
  storyPoints: 'text-green-400',
  dueDate: 'text-pink-400',
}

interface SortableFilterItemProps {
  button: FilterButton
  onToggle: () => void
}

function SortableFilterItem({ button, onToggle }: SortableFilterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: button.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = filterButtonIcons[button.id]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2',
        isDragging && 'z-50 border-amber-500/50 bg-zinc-800 shadow-lg',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Checkbox */}
      <Checkbox
        id={`filter-${button.id}`}
        checked={button.visible}
        onCheckedChange={onToggle}
        className="data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
      />

      {/* Icon */}
      <Icon className={cn('h-4 w-4', filterButtonColors[button.id])} />

      {/* Label */}
      <label
        htmlFor={`filter-${button.id}`}
        className={cn(
          'flex-1 cursor-pointer text-sm',
          button.visible ? 'text-zinc-200' : 'text-zinc-500',
        )}
      >
        {button.label}
      </label>

      {/* Visibility indicator */}
      {button.visible ? (
        <Eye className="h-4 w-4 text-zinc-500" />
      ) : (
        <EyeOff className="h-4 w-4 text-zinc-600" />
      )}
    </div>
  )
}

export function FilterConfig() {
  const {
    filterButtons,
    filterConfigOpen,
    setFilterConfigOpen,
    toggleFilterButtonVisibility,
    reorderFilterButtons,
    resetFilterButtons,
    matchFilterButtonsToColumns,
  } = useBacklogStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = filterButtons.findIndex((b) => b.id === active.id)
      const newIndex = filterButtons.findIndex((b) => b.id === over.id)
      reorderFilterButtons(oldIndex, newIndex)
    }
  }

  const visibleCount = filterButtons.filter((b) => b.visible).length
  const buttonIds = filterButtons.map((b) => b.id)

  return (
    <Sheet open={filterConfigOpen} onOpenChange={setFilterConfigOpen}>
      <SheetContent className="w-[400px] border-zinc-800 bg-zinc-950 p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-zinc-800 px-4 pr-14 py-4">
          <SheetTitle>Configure Filters</SheetTitle>
          <SheetDescription>
            Drag to reorder filter buttons. Toggle visibility with checkboxes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              {visibleCount} of {filterButtons.length} filters visible
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilterButtons}
              className="h-auto p-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          </div>

          {/* Filter button list */}
          <DndContext
            id="filter-config-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={buttonIds} strategy={verticalListSortingStrategy}>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {filterButtons.map((button) => (
                  <SortableFilterItem
                    key={button.id}
                    button={button}
                    onToggle={() => toggleFilterButtonVisibility(button.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Quick actions */}
          <div className="flex gap-2 border-t border-zinc-800 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                for (const btn of filterButtons) {
                  if (!btn.visible) toggleFilterButtonVisibility(btn.id)
                }
              }}
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              Show All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Keep only essential filters
                const essential: FilterButtonId[] = ['type', 'status', 'priority', 'assignee']
                for (const btn of filterButtons) {
                  if (essential.includes(btn.id) && !btn.visible) {
                    toggleFilterButtonVisibility(btn.id)
                  } else if (!essential.includes(btn.id) && btn.visible) {
                    toggleFilterButtonVisibility(btn.id)
                  }
                }
              }}
              className="flex-1"
            >
              <EyeOff className="mr-2 h-4 w-4" />
              Minimal
            </Button>
          </div>

          {/* Match columns action */}
          <Button
            variant="outline"
            size="sm"
            onClick={matchFilterButtonsToColumns}
            className="w-full"
          >
            <Columns className="mr-2 h-4 w-4" />
            Match Visible Columns
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
