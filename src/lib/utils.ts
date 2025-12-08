import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Avatar colors that work well with white text
const AVATAR_COLORS = [
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
    hash = ((hash << 5) - hash) + char
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
