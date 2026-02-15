import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import { compareVersions, getLatestCommit, getLatestRelease } from '@/lib/github-api'
import { getSystemSettings } from '@/lib/system-settings'

const DEFAULT_REPO_URL = 'https://github.com/jmynes/punt/'

export interface UpdateCheckResult {
  local: {
    version: string
    commit: string
    commitShort: string
    buildTime: string | null
  }
  remote: {
    latestVersion: string | null
    latestCommit: string | null
    latestCommitShort: string | null
    releaseUrl: string | null
    releaseName: string | null
    publishedAt: string | null
  }
  updateAvailable: boolean
  commitsBehind: boolean
  repoUrl: string
  error?: string
}

/**
 * GET /api/version/check
 * Check for updates against the configured repository
 * Requires system admin (to rate limit GitHub API usage)
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const settings = await getSystemSettings()
    const repoUrl = settings.canonicalRepoUrl || DEFAULT_REPO_URL

    const localVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'unknown'
    const localCommit = process.env.NEXT_PUBLIC_GIT_COMMIT || 'unknown'
    const localCommitShort = process.env.NEXT_PUBLIC_GIT_COMMIT_SHORT || 'unknown'
    const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || null

    // Fetch remote info in parallel
    const [latestRelease, latestCommit] = await Promise.all([
      getLatestRelease(repoUrl),
      getLatestCommit(repoUrl),
    ])

    // Determine if updates are available
    let updateAvailable = false
    if (latestRelease && localVersion !== 'unknown') {
      updateAvailable = compareVersions(localVersion, latestRelease.tag_name) < 0
    }

    // Check if we're behind on commits
    const commitsBehind = latestCommit ? localCommit !== latestCommit.sha : false

    const result: UpdateCheckResult = {
      local: {
        version: localVersion,
        commit: localCommit,
        commitShort: localCommitShort,
        buildTime,
      },
      remote: {
        latestVersion: latestRelease?.tag_name || null,
        latestCommit: latestCommit?.sha || null,
        latestCommitShort: latestCommit?.sha.slice(0, 7) || null,
        releaseUrl: latestRelease?.html_url || null,
        releaseName: latestRelease?.name || null,
        publishedAt: latestRelease?.published_at || null,
      },
      updateAvailable,
      commitsBehind,
      repoUrl,
    }

    // Add error if we couldn't fetch remote info
    if (!latestRelease && !latestCommit) {
      result.error = 'Could not fetch remote version info. Check the repository URL.'
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error, 'check for updates')
  }
}
