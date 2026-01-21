import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

/**
 * GET /api/dashboard/stats - Get aggregated dashboard statistics
 * Returns ticket counts by status category (open, in progress, completed)
 */
export async function GET() {
  try {
    await requireAuth()

    // Get all tickets with their column names
    const tickets = await db.ticket.findMany({
      select: {
        id: true,
        column: {
          select: {
            name: true,
          },
        },
      },
    })

    // Categorize tickets by column name (same heuristic as the dashboard was using)
    let openTickets = 0
    let inProgress = 0
    let completed = 0

    for (const ticket of tickets) {
      const colName = ticket.column.name.toLowerCase()
      if (colName.includes('done') || colName.includes('complete')) {
        completed++
      } else if (colName.includes('progress') || colName.includes('review')) {
        inProgress++
      } else {
        openTickets++
      }
    }

    return NextResponse.json({
      openTickets,
      inProgress,
      completed,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Account disabled') {
        return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
      }
    }
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
