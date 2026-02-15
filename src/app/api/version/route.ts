import { NextResponse } from 'next/server'

export interface LocalVersionInfo {
  version: string
  commit: string
  commitShort: string
  buildTime: string | null
}

/**
 * GET /api/version
 * Returns local version info (public endpoint, no auth required)
 */
export async function GET() {
  const versionInfo: LocalVersionInfo = {
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    commit: process.env.NEXT_PUBLIC_GIT_COMMIT || 'unknown',
    commitShort: process.env.NEXT_PUBLIC_GIT_COMMIT_SHORT || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
  }

  return NextResponse.json(versionInfo)
}
