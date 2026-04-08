/**
 * Ticket Import Module
 *
 * Provides parsers for importing tickets from Jira and GitHub Issues.
 */

import { parseGitHubJson } from './github-parser'
import { parseJiraJson } from './jira-parser'
import type { ParseResult } from './types'

export { parseGitHubJson } from './github-parser'
export { parseJiraCsv, parseJiraJson } from './jira-parser'
export type { ImportRequest, ImportResult, ParsedTicket, ParseResult } from './types'

/**
 * Auto-detect the source format from JSON data and parse accordingly.
 *
 * Detection heuristics:
 * - Jira: issues have `key` field (e.g., "PROJ-123"), `fields` object, or `issuetype`
 * - GitHub: issues have `number`, `state`, `body` fields, or `pull_request`
 */
export function autoDetectAndParse(data: unknown): ParseResult {
  if (Array.isArray(data) && data.length > 0) {
    const sample = data[0]
    if (typeof sample === 'object' && sample !== null) {
      // Jira indicators: key field like "PROJ-123", fields object, issuetype
      if ('key' in sample || 'fields' in sample) {
        return parseJiraJson(data)
      }
      // GitHub indicators: number, state, body, html_url with github.com
      if ('state' in sample || ('number' in sample && 'body' in sample)) {
        return parseGitHubJson(data)
      }
      if (
        'html_url' in sample &&
        String((sample as Record<string, unknown>).html_url).includes('github.com')
      ) {
        return parseGitHubJson(data)
      }
    }
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    // Jira: { issues: [...] } or single issue with key/fields
    if ('issues' in obj || 'key' in obj || 'fields' in obj) {
      return parseJiraJson(data)
    }
    // GitHub: { items: [...] } (search API) or single issue
    if ('items' in obj || 'state' in obj) {
      return parseGitHubJson(data)
    }
  }

  // Default: try Jira first, then GitHub
  const jiraResult = parseJiraJson(data)
  if (jiraResult.tickets.length > 0) return jiraResult

  return parseGitHubJson(data)
}
