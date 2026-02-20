import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import {
  encryptTotpSecret,
  generateQrCodeDataUrl,
  generateTotpKeyUri,
  generateTotpSecret,
} from '@/lib/totp'

/**
 * POST /api/me/2fa/setup - Generate TOTP secret and QR code URI
 * Returns the secret, QR code, and manual entry key.
 * Does NOT enable 2FA yet - user must verify with /api/me/2fa/verify first.
 */
export async function POST() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({
        secret: 'DEMO_SECRET_KEY_BASE32',
        qrCodeUrl: 'data:image/png;base64,demo',
        manualEntryKey: 'DEMO SECRET KEY BASE32',
      })
    }

    const currentUser = await requireAuth()

    // Check if 2FA is already enabled
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: { totpEnabled: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 },
      )
    }

    // Generate a new TOTP secret
    const secret = generateTotpSecret()

    // Generate the key URI for QR code
    const appName = 'PUNT'
    const keyUri = generateTotpKeyUri(secret, user.username, appName)

    // Generate QR code as data URL
    const qrCodeUrl = await generateQrCodeDataUrl(keyUri)

    // Store encrypted secret temporarily (not yet enabled)
    const encryptedSecret = encryptTotpSecret(secret)
    await db.user.update({
      where: { id: currentUser.id },
      data: { totpSecret: encryptedSecret },
    })

    // Format the secret for manual entry (groups of 4)
    const manualEntryKey = secret.replace(/(.{4})/g, '$1 ').trim()

    return NextResponse.json({
      secret,
      qrCodeUrl,
      manualEntryKey,
    })
  } catch (error) {
    return handleApiError(error, 'setup 2FA')
  }
}
