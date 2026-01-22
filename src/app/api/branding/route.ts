import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { getBrandingSettings } from '@/lib/system-settings'

/**
 * GET /api/branding
 * Fetch branding settings (public endpoint - no auth required)
 * Used by header and login page
 */
export async function GET() {
  try {
    const branding = await getBrandingSettings()
    return NextResponse.json(branding)
  } catch (error) {
    return handleApiError(error, 'fetch branding settings')
  }
}
