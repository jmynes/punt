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
