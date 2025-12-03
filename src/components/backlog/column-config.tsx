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
import { Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
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
import { type BacklogColumn, useBacklogStore } from '@/stores/backlog-store'

interface SortableColumnItemProps {
	column: BacklogColumn
	onToggle: () => void
}

function SortableColumnItem({ column, onToggle }: SortableColumnItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: column.id,
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
				id={`col-${column.id}`}
				checked={column.visible}
				onCheckedChange={onToggle}
				className="data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
			/>

			{/* Label */}
			<label
				htmlFor={`col-${column.id}`}
				className={cn(
					'flex-1 cursor-pointer text-sm',
					column.visible ? 'text-zinc-200' : 'text-zinc-500',
				)}
			>
				{column.label}
			</label>

			{/* Visibility indicator */}
			{column.visible ? (
				<Eye className="h-4 w-4 text-zinc-500" />
			) : (
				<EyeOff className="h-4 w-4 text-zinc-600" />
			)}
		</div>
	)
}

export function ColumnConfig() {
	const {
		columns,
		columnConfigOpen,
		setColumnConfigOpen,
		toggleColumnVisibility,
		reorderColumns,
		resetColumns,
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
			const oldIndex = columns.findIndex((c) => c.id === active.id)
			const newIndex = columns.findIndex((c) => c.id === over.id)
			reorderColumns(oldIndex, newIndex)
		}
	}

	const visibleCount = columns.filter((c) => c.visible).length
	const columnIds = columns.map((c) => c.id)

	return (
		<Sheet open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
			<SheetContent className="w-[400px] border-zinc-800 bg-zinc-950 sm:max-w-[400px]">
				<SheetHeader>
					<SheetTitle>Configure Columns</SheetTitle>
					<SheetDescription>
						Drag to reorder columns. Toggle visibility with checkboxes.
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 flex flex-col gap-4">
					{/* Stats */}
					<div className="flex items-center justify-between text-sm text-zinc-400">
						<span>
							{visibleCount} of {columns.length} columns visible
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={resetColumns}
							className="h-auto p-1 text-xs text-zinc-500 hover:text-zinc-300"
						>
							<RotateCcw className="mr-1 h-3 w-3" />
							Reset
						</Button>
					</div>

					{/* Column list */}
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
							<div className="flex flex-col gap-2">
								{columns.map((column) => (
									<SortableColumnItem
										key={column.id}
										column={column}
										onToggle={() => toggleColumnVisibility(column.id)}
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
								for (const col of columns) {
									if (!col.visible) toggleColumnVisibility(col.id)
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
								// Keep only essential columns
								const essential = ['type', 'key', 'title', 'status', 'priority']
								for (const col of columns) {
									if (essential.includes(col.id) && !col.visible) {
										toggleColumnVisibility(col.id)
									} else if (!essential.includes(col.id) && col.visible) {
										toggleColumnVisibility(col.id)
									}
								}
							}}
							className="flex-1"
						>
							<EyeOff className="mr-2 h-4 w-4" />
							Minimal
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}
