'use client'

import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
	value: Date | null
	onChange: (value: Date | null) => void
	placeholder?: string
	disabled?: boolean
}

export function DatePicker({
	value,
	onChange,
	placeholder = 'Pick a date',
	disabled,
}: DatePickerProps) {
	return (
		<div className="flex gap-2">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						disabled={disabled}
						className={cn(
							'flex-1 justify-start text-left font-normal bg-zinc-900 border-zinc-700 hover:bg-zinc-800',
							!value && 'text-zinc-500',
						)}
					>
						<CalendarIcon className="mr-2 h-4 w-4" />
						{value ? format(value, 'PPP') : placeholder}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
					<Calendar
						mode="single"
						selected={value || undefined}
						onSelect={(date) => onChange(date || null)}
						initialFocus
						className="bg-zinc-900"
					/>
				</PopoverContent>
			</Popover>
			{value && (
				<Button
					type="button"
					variant="outline"
					size="icon"
					disabled={disabled}
					className="shrink-0 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
					onClick={() => onChange(null)}
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</div>
	)
}
