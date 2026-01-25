/**
 * Demo mode configuration
 *
 * When NEXT_PUBLIC_DEMO_MODE=true, the app runs entirely client-side:
 * - No database connection required
 * - All data stored in localStorage
 * - Auto-authenticated as demo user
 */

export const isDemoMode = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const DEMO_USER = {
  id: 'demo-user-1',
  username: 'demo',
  name: 'Demo User',
  email: 'demo@punt.app',
  avatar: null,
  isSystemAdmin: false,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as const

export const DEMO_STORAGE_PREFIX = 'punt-demo-'
