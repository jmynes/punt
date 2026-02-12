#!/usr/bin/env node
/**
 * Release helper script
 *
 * Usage:
 *   pnpm release <version>
 *   pnpm release patch|minor|major
 *
 * Examples:
 *   pnpm release 0.2.0
 *   pnpm release patch  # 0.1.0 -> 0.1.1
 *   pnpm release minor  # 0.1.0 -> 0.2.0
 *   pnpm release major  # 0.1.0 -> 1.0.0
 *
 * This script:
 * 1. Updates package.json version
 * 2. Commits the version bump
 * 3. Creates a git tag
 * 4. Pushes the tag to trigger the release workflow
 */

const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const currentVersion = packageJson.version

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] || '',
  }
}

function bumpVersion(current, type) {
  const v = parseVersion(current)

  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`
    case 'patch':
      return `${v.major}.${v.minor}.${v.patch + 1}`
    default:
      // Assume it's an explicit version
      parseVersion(type) // Validate format
      return type
  }
}

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { stdio: 'inherit' })
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: pnpm release <version|patch|minor|major>')
    console.error(`Current version: ${currentVersion}`)
    process.exit(1)
  }

  const input = args[0]
  let newVersion

  try {
    newVersion = bumpVersion(currentVersion, input)
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }

  console.log(`\nReleasing: ${currentVersion} -> ${newVersion}\n`)

  // Check for uncommitted changes
  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD'], { stdio: 'pipe' })
  } catch (_e) {
    console.error(
      'Error: Working directory has uncommitted changes. Please commit or stash them first.',
    )
    process.exit(1)
  }

  // Check we're on main branch
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  if (branch !== 'main') {
    console.error(`Error: Releases should be made from the main branch. Currently on: ${branch}`)
    process.exit(1)
  }

  // Update package.json
  packageJson.version = newVersion
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  console.log(`Updated package.json version to ${newVersion}`)

  // Commit the version bump
  run('git', ['add', 'package.json'])
  run('git', ['commit', '-m', `chore(release): bump version to ${newVersion}`])

  // Create and push tag
  run('git', ['tag', '-a', `v${newVersion}`, '-m', `Release v${newVersion}`])
  run('git', ['push', 'origin', 'main'])
  run('git', ['push', 'origin', `v${newVersion}`])

  console.log(`\nRelease v${newVersion} has been tagged and pushed!`)
  console.log('The GitHub Actions release workflow will now create the release.')
}

main()
