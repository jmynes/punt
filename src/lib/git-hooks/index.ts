/**
 * Git hooks integration module.
 *
 * Provides utilities for parsing commit messages and extracting ticket references.
 */

export {
  type CommitPattern,
  extractTicketKeys,
  getTicketAction,
  type ParsedCommit,
  parseCommitMessage,
  parseCommitMessageWithPatterns,
  parseCommits,
  referencesTicket,
  type TicketAction,
  type TicketReference,
} from './commit-parser'
