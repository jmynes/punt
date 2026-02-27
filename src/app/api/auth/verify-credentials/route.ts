import { NextResponse } from 'next/server'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(request: Request) {
  try {
    // Require admin authentication
    const currentUser = await requireSystemAdmin()

    const body = await request.json()
    const { username, password } = body

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    // Get the user's username and password hash from the database
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { username: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Unable to verify credentials' }, { status: 401 })
    }

    // If username is provided, verify it matches the current user
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      return NextResponse.json({ error: 'Username does not match your account' }, { status: 401 })
    }

    // Verify the password
    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    return NextResponse.json({ verified: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Verify credentials error:', error)
    return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 })
  }
}
