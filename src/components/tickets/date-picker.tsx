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
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className={cn('w-full justify-start text-left font-normal', !value && 'text-zinc-500')}
				>
					<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
					<span className="flex-1 truncate">
						{value ? format(value, 'MMM d, yyyy') : placeholder}
					</span>
					{value && (
						<span
							role="button"
							tabIndex={0}
							onClick={(e) => {
								e.stopPropagation()
								onChange(null)
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.stopPropagation()
									onChange(null)
								}
							}}
							className="ml-2 rounded p-0.5 hover:bg-red-900/50 hover:text-red-400 transition-colors"
						>
							<X className="h-4 w-4" />
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
				<Calendar
					mode="single"
					selected={value || undefined}
					onSelect={(date) => onChange(date || null)}
					numberOfMonths={1}
					initialFocus
					className="bg-zinc-900"
					classNames={
						value
							? {
									// Hide today indicator when a different date is selected
									today: 'text-foreground',
								}
							: undefined
					}
				/>
			</PopoverContent>
		</Popover>
	)
}
