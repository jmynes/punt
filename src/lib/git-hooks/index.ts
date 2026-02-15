/**
 * Git hooks integration module.
 *
 * Provides utilities for parsing commit messages and extracting ticket references.
 */

export {
  extractTicketKeys,
  getTicketAction,
  type ParsedCommit,
  parseCommitMessage,
  parseCommits,
  referencesTicket,
  type TicketAction,
  type TicketReference,
} from './commit-parser'
