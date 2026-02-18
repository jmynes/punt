import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Avatar colors that work well with white text
export const AVATAR_COLORS = [
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#d97706', // amber-600
  '#65a30d', // lime-600
  '#16a34a', // green-600
  '#059669', // emerald-600
  '#0d9488', // teal-600
  '#0891b2', // cyan-600
  '#0284c7', // sky-600
  '#2563eb', // blue-600
  '#4f46e5', // indigo-600
  '#7c3aed', // violet-600
  '#9333ea', // purple-600
  '#c026d3', // fuchsia-600
  '#db2777', // pink-600
  '#e11d48', // rose-600
]

/**
 * Generate a consistent color for an avatar based on a string (name, id, email)
 * The same input will always return the same color
 */
export function getAvatarColor(identifier: string): string {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

/**
 * Get initials from a name (first letter of first and last name)
 * e.g., "Alice Smith" -> "AS", "Bob" -> "B"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) // Max 2 characters
}

/**
 * Parse a hex color string to RGB components.
 * Supports 3-char (#abc) and 6-char (#aabbcc) hex formats.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null
  }
  const fullHex =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned
  return {
    r: Number.parseInt(fullHex.slice(0, 2), 16),
    g: Number.parseInt(fullHex.slice(2, 4), 16),
    b: Number.parseInt(fullHex.slice(4, 6), 16),
  }
}

/**
 * Convert RGB to hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Calculate relative luminance of a color per WCAG 2.0.
 * Returns a value between 0 (black) and 1 (white).
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Get a legible text color derived from a label color for use on dark backgrounds.
 * Lightens dark/medium colors and slightly desaturates overly vivid colors
 * to ensure readability at small text sizes (10-12px) on dark UI backgrounds.
 */
export function getLabelTextColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const { r, g, b } = rgb
  const luminance = getLuminance(r, g, b)
  if (Number.isNaN(luminance)) return '#ffffff'

  // Target minimum luminance for legible text on dark backgrounds (~zinc-900 bg).
  // WCAG AA requires 4.5:1 contrast for small text. zinc-900 (#18181b) has
  // luminance ~0.02. For 5:1 contrast: L_text = 5 * (0.02 + 0.05) - 0.05 = 0.3
  const minLuminance = 0.3

  if (luminance >= minLuminance) {
    // Color is already bright enough - return as-is
    return hex
  }

  // Lighten the color by mixing with white, preserving the hue.
  // Calculate how much to mix toward white to reach target luminance.
  // We use an iterative approach for accuracy with the non-linear sRGB gamma.
  let lo = 0
  let hi = 1
  let bestHex = hex

  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    const mr = r + (255 - r) * mid
    const mg = g + (255 - g) * mid
    const mb = b + (255 - b) * mid
    const lum = getLuminance(mr, mg, mb)

    bestHex = rgbToHex(mr, mg, mb)

    if (lum < minLuminance) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return bestHex
}

/**
 * Get consistent label style properties for rendering label badges.
 * Returns an object with backgroundColor, borderColor, and color (text)
 * that ensures legibility on dark backgrounds.
 */
export function getLabelStyles(labelColor: string): {
  backgroundColor: string
  borderColor: string
  color: string
} {
  const rgb = hexToRgb(labelColor)
  if (!rgb) {
    return { backgroundColor: '#ffffff20', borderColor: '#ffffff', color: '#ffffff' }
  }
  return {
    backgroundColor: `${labelColor}20`,
    borderColor: labelColor,
    color: getLabelTextColor(labelColor),
  }
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return 'just now'
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays === 1) {
    return 'yesterday'
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}w ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}mo ago`
  }
  const years = Math.floor(diffDays / 365)
  return `${years}y ago`
}
