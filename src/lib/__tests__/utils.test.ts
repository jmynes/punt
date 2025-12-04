import { describe, expect, it } from 'vitest'
import { cn } from '../utils'

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
