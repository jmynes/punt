import { NextResponse } from 'next/server'
import { requireAuth, requireProjectMember } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { LABEL_SELECT } from '@/lib/prisma-selects'

/**
 * GET /api/projects/[projectId]/labels - Get all labels for a project
 * Requires project membership
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireAuth()
    const { projectId } = await params

    // Check project membership
    await requireProjectMember(user.id, projectId)

    const labels = await db.label.findMany({
      where: { projectId },
      select: LABEL_SELECT,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(labels)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.startsWith('Forbidden:')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }
    console.error('Failed to fetch labels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
