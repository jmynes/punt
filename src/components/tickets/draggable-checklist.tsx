'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
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
import { GripVertical } from 'lucide-react'
import { useCallback, useId, useState } from 'react'
import type { ChecklistItem } from '@/lib/markdown-checklist'
import { cn } from '@/lib/utils'

interface DraggableChecklistProps {
  items: ChecklistItem[]
  onReorder: (reorderedItems: ChecklistItem[]) => void
  onToggle?: (itemId: string, checked: boolean) => void
}

interface SortableChecklistItemProps {
  item: ChecklistItem
  onToggle?: (itemId: string, checked: boolean) => void
}

function SortableChecklistItem({ item, onToggle }: SortableChecklistItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/item flex items-start gap-1.5 list-none py-0.5 rounded',
        isDragging && 'opacity-30',
      )}
    >
      <button
        type="button"
        className="mt-0.5 flex-shrink-0 cursor-grab touch-none text-zinc-600 opacity-0 group-hover/item:opacity-100 transition-opacity hover:text-zinc-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <label
        className="flex items-start gap-2 cursor-pointer min-w-0 flex-1"
        onClick={(e) => {
          // Prevent the click from bubbling to parent elements
          // (e.g., the button that opens the description editor)
          e.stopPropagation()
        }}
        onKeyDown={undefined}
      >
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => {
            e.stopPropagation()
            onToggle?.(item.id, e.target.checked)
          }}
          className="mt-1 h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-amber-500"
        />
        <span
          className={cn(
            'text-sm text-zinc-300 break-words min-w-0',
            item.checked && 'line-through text-zinc-500',
          )}
        >
          {item.text}
        </span>
      </label>
    </li>
  )
}

function DragOverlayItem({ item }: { item: ChecklistItem }) {
  return (
    <li className="flex items-start gap-1.5 list-none py-0.5 bg-zinc-800 shadow-lg ring-1 ring-amber-500/50 rounded-md px-1">
      <span className="mt-0.5 flex-shrink-0 text-zinc-400">
        <GripVertical className="h-4 w-4" />
      </span>
      <label className="flex items-start gap-2 cursor-pointer min-w-0 flex-1">
        <input
          type="checkbox"
          checked={item.checked}
          readOnly
          className="mt-1 h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 text-amber-500 accent-amber-500"
        />
        <span
          className={cn(
            'text-sm text-zinc-300 break-words min-w-0',
            item.checked && 'line-through text-zinc-500',
          )}
        >
          {item.text}
        </span>
      </label>
    </li>
  )
}

export function DraggableChecklist({ items, onReorder, onToggle }: DraggableChecklistProps) {
  const dndId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...items]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      onReorder(reordered)
    },
    [items, onReorder],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {/* Stop propagation to prevent parent elements (e.g., description edit trigger) from activating */}
        <ul
          className="ml-0 space-y-0 list-none pl-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Only stop propagation for Enter/Space to prevent parent button activation
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
        >
          {items.map((item) => (
            <SortableChecklistItem key={item.id} item={item} onToggle={onToggle} />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>{activeItem ? <DragOverlayItem item={activeItem} /> : null}</DragOverlay>
    </DndContext>
  )
}
