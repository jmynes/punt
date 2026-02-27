import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { handleApiError, validationError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { verifyPassword } from '@/lib/password'
import { decryptTotpSecret, verifyTotpToken } from '@/lib/totp'

const reset2faSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
})

/**
 * DELETE /api/admin/users/[username]/2fa - Admin reset user's 2FA
 * Disables 2FA and clears all TOTP data for the specified user.
 * Requires admin password confirmation and, if the admin has 2FA enabled,
 * a valid TOTP code from the admin.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const admin = await requireSystemAdmin()
    const { username } = await params

    if (isDemoMode()) {
      return NextResponse.json({ success: true })
    }

    // Parse and validate the request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Password confirmation is required to reset 2FA' },
        { status: 400 },
      )
    }

    const parsed = reset2faSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed)
    }

    const { password, totpCode } = parsed.data

    // Verify the admin's password
    const adminUser = await db.user.findUnique({
      where: { id: admin.id },
      select: {
        passwordHash: true,
        totpEnabled: true,
        totpSecret: true,
      },
    })

    if (!adminUser?.passwordHash) {
      return NextResponse.json({ error: 'Unable to verify admin credentials' }, { status: 400 })
    }

    const isValidPassword = await verifyPassword(password, adminUser.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // If the admin has 2FA enabled, require a valid TOTP code
    if (adminUser.totpEnabled && adminUser.totpSecret) {
      if (!totpCode) {
        return NextResponse.json(
          { error: 'Two-factor authentication code is required' },
          { status: 400 },
        )
      }

      const secret = decryptTotpSecret(adminUser.totpSecret)
      const isValidTotp = verifyTotpToken(totpCode, secret)
      if (!isValidTotp) {
        return NextResponse.json(
          { error: 'Invalid two-factor authentication code' },
          { status: 401 },
        )
      }
    }

    // Find the target user
    const targetUser = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, totpEnabled: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled for this user' },
        { status: 400 },
      )
    }

    // Disable 2FA and clear all TOTP data
    await db.user.update({
      where: { id: targetUser.id },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpRecoveryCodes: Prisma.DbNull,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'reset user 2FA')
  }
}
