import type * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'border-input placeholder:text-muted-foreground dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				'hover:bg-amber-500/15 hover:border-zinc-600',
				'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:bg-transparent',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			{...props}
		/>
	)
}

export { Textarea }
