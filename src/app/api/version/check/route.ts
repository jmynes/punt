import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'
import { requireSystemAdmin } from '@/lib/auth-helpers'
import {
  compareCommits,
  compareVersions,
  getLatestCommit,
  getLatestRelease,
} from '@/lib/github-api'
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
  // Release comparison
  updateAvailable: boolean
  // Commit comparison
  commitStatus: {
    aheadBy: number
    behindBy: number
    status: 'ahead' | 'behind' | 'identical' | 'diverged' | 'unknown'
  }
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

    // Determine if a new release is available
    let updateAvailable = false
    if (latestRelease && localVersion !== 'unknown') {
      updateAvailable = compareVersions(localVersion, latestRelease.tag_name) < 0
    }

    // Compare commits to see ahead/behind status
    let commitStatus: UpdateCheckResult['commitStatus'] = {
      aheadBy: 0,
      behindBy: 0,
      status: 'unknown',
    }

    if (latestCommit && localCommit !== 'unknown') {
      if (localCommit === latestCommit.sha) {
        commitStatus = { aheadBy: 0, behindBy: 0, status: 'identical' }
      } else {
        // Compare local commit against remote main
        // We're asking: how does local compare to remote?
        // base = remote (main), head = local
        const comparison = await compareCommits(repoUrl, latestCommit.sha, localCommit)
        if (comparison) {
          commitStatus = comparison
        }
        // If comparison fails (e.g., local commit not in upstream repo),
        // status remains 'unknown'
      }
    }

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
      commitStatus,
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
