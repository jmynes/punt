import { execSync } from 'node:child_process'
import type { NextConfig } from 'next'

// Get git info at build time
// Note: Uses execSync with hardcoded commands (no user input) - safe for build-time use
function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse HEAD').toString().trim()
    const commitHashShort = execSync('git rev-parse --short HEAD').toString().trim()
    return { commitHash, commitHashShort }
  } catch {
    return { commitHash: 'unknown', commitHashShort: 'unknown' }
  }
}

// Get version from package.json
function getVersion() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('./package.json')
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

const gitInfo = getGitInfo()
const version = getVersion()

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_GIT_COMMIT: gitInfo.commitHash,
    NEXT_PUBLIC_GIT_COMMIT_SHORT: gitInfo.commitHashShort,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
