import { describe, expect, it } from 'vitest'
import {
  getColumnIcon,
  getStatusIcon,
  resolveColumnColor,
  resolveColumnIconName,
  TAILWIND_TO_HEX,
} from '../status-icons'

describe('getStatusIcon', () => {
  it('maps known status names (case/space-insensitive) to an icon+color', () => {
    const done = getStatusIcon('Done')
    expect(done.color).toBe('text-emerald-400')
    expect(getStatusIcon('  in progress ').color).toBe('text-amber-400')
  })

  it('falls back to a neutral circle for unknown names', () => {
    expect(getStatusIcon('whatever').color).toBe('text-zinc-400')
  })
})

describe('resolveColumnIconName', () => {
  it('prefers an explicit icon name', () => {
    expect(resolveColumnIconName('rocket', 'To Do')).toBe('rocket')
  })

  it('derives a name from the column name heuristic', () => {
    // "done" -> CheckCircle2 -> its registered name (non-null)
    expect(resolveColumnIconName(null, 'Done')).not.toBeNull()
  })

  it('returns null when neither is provided', () => {
    expect(resolveColumnIconName(null, undefined)).toBeNull()
  })
})

describe('resolveColumnColor', () => {
  it('returns a custom hex color as-is', () => {
    expect(resolveColumnColor('#123456', null, 'Done')).toBe('#123456')
  })

  it('converts the name-derived Tailwind class to hex', () => {
    expect(resolveColumnColor(null, null, 'Done')).toBe(TAILWIND_TO_HEX['text-emerald-400'])
  })

  it('returns null when nothing resolves', () => {
    expect(resolveColumnColor(null, null, undefined)).toBeNull()
  })
})

describe('getColumnIcon', () => {
  it('uses the name heuristic when no custom icon is set', () => {
    expect(getColumnIcon(null, 'Done').color).toBe('text-emerald-400')
  })

  it('applies a hex color override over the name heuristic', () => {
    expect(getColumnIcon(null, 'Done', '#abcdef').color).toBe('#abcdef')
  })

  it('falls back to a neutral circle with optional hex override', () => {
    expect(getColumnIcon(null, undefined).color).toBe('text-zinc-400')
    expect(getColumnIcon(null, undefined, '#fff').color).toBe('#fff')
  })
})
