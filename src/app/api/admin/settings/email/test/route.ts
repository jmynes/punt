import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  badRequestError,
  handleApiError,
  rateLimitExceeded,
  validationError,
} from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { isEmailConfigured, sendTestEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const TestEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * POST /api/admin/settings/email/test
 * Send a test email to verify email configuration
 * Requires system admin
 */
export async function POST(request: Request) {
  try {
    await requireSystemAdmin()

    // Rate limit test emails
    const clientIp = getClientIp(request)
    const rateLimit = await checkRateLimit(clientIp, 'admin/email-test')
    if (!rateLimit.allowed) {
      return rateLimitExceeded(rateLimit)
    }

    const body = await request.json()
    const parsed = TestEmailSchema.safeParse(body)

    if (!parsed.success) {
      return validationError(parsed)
    }

    const { email } = parsed.data

    // Check if email is configured
    const configured = await isEmailConfigured()
    if (!configured) {
      return badRequestError('Email is not configured. Please configure email settings first.')
    }

    // Send test email
    const result = await sendTestEmail(email)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send test email' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message: `Test email sent successfully to ${email}`,
    })
  } catch (error) {
    return handleApiError(error, 'send test email')
  }
}
