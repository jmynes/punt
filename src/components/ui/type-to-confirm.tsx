'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TypeToConfirmInputProps {
  requiredText: string
  value: string
  onChange: (value: string) => void
  textColor?: string
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

export function TypeToConfirmInput({
  requiredText,
  value,
  onChange,
  textColor = 'text-red-400',
  disabled,
  autoFocus,
  id,
}: TypeToConfirmInputProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">
        Type <span className={cn('font-mono font-semibold', textColor)}>{requiredText}</span> to
        confirm:
      </p>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={requiredText}
        className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
