'use client'

import type { UserSummary } from '@/types'

// Demo user - in production this would come from auth
const DEMO_USER: UserSummary = {
  id: 'user-1',
  name: 'Demo User',
  email: 'demo@punt.local',
  avatar: null,
}

// Demo project members
export const DEMO_MEMBERS: UserSummary[] = [
  DEMO_USER,
  { id: 'user-2', name: 'Alice Smith', email: 'alice@punt.local', avatar: null },
  { id: 'user-3', name: 'Bob Johnson', email: 'bob@punt.local', avatar: null },
  { id: 'user-4', name: 'Carol Williams', email: 'carol@punt.local', avatar: null },
]

export function useCurrentUser(): UserSummary {
  // In production, this would fetch from auth context
  return DEMO_USER
}

export function useProjectMembers(): UserSummary[] {
  // In production, this would fetch from API based on project
  return DEMO_MEMBERS
}
