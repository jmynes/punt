import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Get the current user from server-side session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isSystemAdmin: true,
      isActive: true,
    },
  })

  return user
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (!user.isActive) {
    throw new Error('Account disabled')
  }

  return user
}

/**
 * Require system admin - throws if not system admin
 */
export async function requireSystemAdmin() {
  const user = await requireAuth()

  if (!user.isSystemAdmin) {
    throw new Error('Forbidden: System admin required')
  }

  return user
}
