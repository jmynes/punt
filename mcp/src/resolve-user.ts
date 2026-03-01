import { listUsers, type UserData } from './api-client.js'
import { errorResponse } from './utils.js'

/**
 * Result of resolving a user identifier.
 * On success, `user` is the matched user.
 * On failure, `error` is an MCP error response ready to return.
 */
export type ResolveUserResult =
  | { user: UserData; error?: never }
  | { user?: never; error: ReturnType<typeof errorResponse> }

/**
 * Resolve a user identifier by fuzzy-matching against:
 * - Full display name
 * - First name (first word of display name)
 * - Last name (last word of display name)
 * - Username
 * - Email
 *
 * If exactly one user matches, returns that user.
 * If multiple users match, returns an error listing the matches for clarification.
 * If no users match, returns a helpful error listing available users.
 */
export async function resolveUser(identifier: string): Promise<ResolveUserResult> {
  const usersResult = await listUsers()
  if (usersResult.error) {
    return { error: errorResponse(usersResult.error) }
  }

  const users = usersResult.data ?? []
  const input = identifier.toLowerCase()

  const matches = users.filter((u) => {
    const name = u.name.toLowerCase()
    const nameParts = name.split(/\s+/)
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const username = u.username.toLowerCase()
    const email = u.email?.toLowerCase() ?? ''

    return (
      name === input ||
      firstName === input ||
      lastName === input ||
      username === input ||
      email === input
    )
  })

  if (matches.length === 1) {
    return { user: matches[0] }
  }

  if (matches.length > 1) {
    const matchList = matches
      .map((u) => `- ${u.name} (username: ${u.username}${u.email ? `, email: ${u.email}` : ''})`)
      .join('\n')
    return {
      error: errorResponse(`Multiple users match "${identifier}". Please clarify:\n${matchList}`),
    }
  }

  // No exact matches - try substring matching as a fallback
  const substringMatches = users.filter((u) => {
    const name = u.name.toLowerCase()
    const username = u.username.toLowerCase()
    const email = u.email?.toLowerCase() ?? ''

    return name.includes(input) || username.includes(input) || email.includes(input)
  })

  if (substringMatches.length === 1) {
    return { user: substringMatches[0] }
  }

  if (substringMatches.length > 1) {
    const matchList = substringMatches
      .map((u) => `- ${u.name} (username: ${u.username}${u.email ? `, email: ${u.email}` : ''})`)
      .join('\n')
    return {
      error: errorResponse(`Multiple users match "${identifier}". Please clarify:\n${matchList}`),
    }
  }

  // No matches at all
  const availableUsers = users
    .map((u) => `- ${u.name} (username: ${u.username}${u.email ? `, email: ${u.email}` : ''})`)
    .join('\n')
  return {
    error: errorResponse(
      `No user found matching "${identifier}". Available users:\n${availableUsers}`,
    ),
  }
}
