import { describe, expect, it } from 'vitest'
import { cn, getLabelStyles, getLabelTextColor } from '../utils'

describe('cn (class name utility)', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
  })

  it('should handle undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('should handle empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar')
  })

  it('should merge Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('should handle mixed inputs', () => {
    expect(cn('foo', ['bar', 'baz'], { qux: true }, 'quux')).toBe('foo bar baz qux quux')
  })

  it('should handle no arguments', () => {
    expect(cn()).toBe('')
  })

  it('should handle only falsy values', () => {
    expect(cn(false, null, undefined, '')).toBe('')
  })
})

describe('getLabelTextColor', () => {
  it('should return bright colors unchanged', () => {
    // White has luminance 1.0, well above 0.3
    expect(getLabelTextColor('#ffffff')).toBe('#ffffff')
  })

  it('should return light colors unchanged', () => {
    // Yellow (#facc15) is bright enough already
    const result = getLabelTextColor('#facc15')
    expect(result).toBe('#facc15')
  })

  it('should lighten dark colors', () => {
    // Pure red (#ef4444) is dark — should be lightened
    const result = getLabelTextColor('#ef4444')
    expect(result).not.toBe('#ef4444')
    // Lightened result should be a brighter red
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('should lighten very dark colors like slate', () => {
    const result = getLabelTextColor('#64748b')
    expect(result).not.toBe('#64748b')
  })

  it('should handle 3-char hex', () => {
    const result = getLabelTextColor('#fff')
    expect(result).toBe('#fff')
  })

  it('should handle hex without hash', () => {
    // ffffff without # — should still work
    const result = getLabelTextColor('ffffff')
    expect(result).toBe('ffffff')
  })

  it('should return white for invalid hex', () => {
    expect(getLabelTextColor('notacolor')).toBe('#ffffff')
    expect(getLabelTextColor('')).toBe('#ffffff')
    expect(getLabelTextColor('#xyz')).toBe('#ffffff')
  })

  it('should achieve sufficient contrast for dark colors', () => {
    // Helper: compute relative luminance from hex
    function luminanceFromHex(hex: string) {
      const cleaned = hex.replace('#', '')
      const full =
        cleaned.length === 3
          ? cleaned
              .split('')
              .map((c) => c + c)
              .join('')
          : cleaned
      const [r, g, b] = [0, 2, 4].map((i) => {
        const s = Number.parseInt(full.slice(i, i + 2), 16) / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const zinc900Lum = luminanceFromHex('#18181b') // ~0.02
    const darkColors = ['#ef4444', '#8b5cf6', '#3b82f6', '#64748b', '#78716c', '#ec4899']

    for (const color of darkColors) {
      const adjusted = getLabelTextColor(color)
      const textLum = luminanceFromHex(adjusted)
      const contrast = (textLum + 0.05) / (zinc900Lum + 0.05)
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('getLabelStyles', () => {
  it('should return background, border, and text color', () => {
    const styles = getLabelStyles('#3b82f6')
    expect(styles.backgroundColor).toBe('#3b82f620')
    expect(styles.borderColor).toBe('#3b82f6')
    expect(styles.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('should return white fallback for invalid color', () => {
    const styles = getLabelStyles('invalid')
    expect(styles.color).toBe('#ffffff')
    expect(styles.borderColor).toBe('#ffffff')
    expect(styles.backgroundColor).toBe('#ffffff20')
  })
})
