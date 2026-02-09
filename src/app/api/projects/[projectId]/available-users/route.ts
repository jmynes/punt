import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth, requirePermission, requireProjectByKey } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * GET /api/projects/[projectId]/available-users - Get users NOT in the project
 * Returns active users who are not already members of this project.
 * Requires members.manage permission.
 *
 * Query params:
 * - search: optional string to filter by name/email
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId: projectKey } = await params
    const projectId = await requireProjectByKey(projectKey)

    // Check permission to manage members
    await requirePermission(user.id, projectId, PERMISSIONS.MEMBERS_MANAGE)

    // Get search query
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.trim() || ''

    // Get existing member user IDs
    const existingMembers = await db.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    })
    const existingUserIds = existingMembers.map((m) => m.userId)

    // Build where clause
    type WhereClause = {
      isActive: true
      id?: { notIn: string[] }
      OR?: Array<
        | { name: { contains: string } }
        | { email: { contains: string } }
        | { username: { contains: string } }
      >
    }

    const where: WhereClause = { isActive: true }

    if (existingUserIds.length > 0) {
      where.id = { notIn: existingUserIds }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
      ]
    }

    // Find active users not in the project
    const availableUsers = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      orderBy: { name: 'asc' },
      take: 20, // Limit results for performance
    })

    return NextResponse.json(availableUsers)
  } catch (error) {
    return handleApiError(error, 'fetch available users')
  }
}
