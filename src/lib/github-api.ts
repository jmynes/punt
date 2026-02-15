/**
 * GitHub API helpers for fetching release and commit information
 */

export interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  body: string
}

export interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    }
  }
}

export interface RemoteVersionInfo {
  latestRelease: GitHubRelease | null
  latestCommit: GitHubCommit | null
  error?: string
}

/**
 * Parse a GitHub repository URL to extract owner and repo name
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/
 * - https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('github.com')) {
      return null
    }

    // Remove leading slash and trailing .git or /
    const path = parsed.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
    const parts = path.split('/')

    if (parts.length < 2) {
      return null
    }

    return {
      owner: parts[0],
      repo: parts[1],
    }
  } catch {
    return null
  }
}

/**
 * Fetch the latest release from a GitHub repository
 */
export async function getLatestRelease(repoUrl: string): Promise<GitHubRelease | null> {
  const parsed = parseGitHubUrl(repoUrl)
  if (!parsed) {
    return null
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PUNT-Update-Checker',
        },
        // Cache for 5 minutes
        next: { revalidate: 300 },
      },
    )

    if (!response.ok) {
      // 404 means no releases exist
      if (response.status === 404) {
        return null
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('Failed to fetch latest release:', error)
    return null
  }
}

/**
 * Fetch the latest commit from the default branch of a GitHub repository
 */
export async function getLatestCommit(
  repoUrl: string,
  branch = 'main',
): Promise<GitHubCommit | null> {
  const parsed = parseGitHubUrl(repoUrl)
  if (!parsed) {
    return null
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${branch}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PUNT-Update-Checker',
        },
        // Cache for 5 minutes
        next: { revalidate: 300 },
      },
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('Failed to fetch latest commit:', error)
    return null
  }
}

export interface CommitComparison {
  aheadBy: number
  behindBy: number
  status: 'ahead' | 'behind' | 'identical' | 'diverged'
}

/**
 * Compare two commits to see how many commits ahead/behind
 * Uses GitHub's compare API: base...head
 * Returns ahead_by (head is ahead of base) and behind_by (head is behind base)
 */
export async function compareCommits(
  repoUrl: string,
  baseCommit: string,
  headCommit: string,
): Promise<CommitComparison | null> {
  const parsed = parseGitHubUrl(repoUrl)
  if (!parsed) {
    return null
  }

  // If commits are the same, no need to call API
  if (baseCommit === headCommit) {
    return { aheadBy: 0, behindBy: 0, status: 'identical' }
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/compare/${baseCommit}...${headCommit}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PUNT-Update-Checker',
        },
        next: { revalidate: 300 },
      },
    )

    if (!response.ok) {
      // 404 likely means one of the commits doesn't exist in this repo
      // (e.g., local commit from a fork not pushed to upstream)
      if (response.status === 404) {
        return null
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      aheadBy: data.ahead_by || 0,
      behindBy: data.behind_by || 0,
      status: data.status as 'ahead' | 'behind' | 'identical' | 'diverged',
    }
  } catch (error) {
    console.error('Failed to compare commits:', error)
    return null
  }
}

/**
 * Compare semantic versions
 * Returns:
 *  - negative if a < b
 *  - 0 if a === b
 *  - positive if a > b
 */
export function compareVersions(a: string, b: string): number {
  // Strip leading 'v' if present
  const cleanA = a.replace(/^v/, '')
  const cleanB = b.replace(/^v/, '')

  const partsA = cleanA.split('.').map((n) => parseInt(n, 10) || 0)
  const partsB = cleanB.split('.').map((n) => parseInt(n, 10) || 0)

  // Pad arrays to same length
  const maxLen = Math.max(partsA.length, partsB.length)
  while (partsA.length < maxLen) partsA.push(0)
  while (partsB.length < maxLen) partsB.push(0)

  for (let i = 0; i < maxLen; i++) {
    if (partsA[i] < partsB[i]) return -1
    if (partsA[i] > partsB[i]) return 1
  }

  return 0
}
