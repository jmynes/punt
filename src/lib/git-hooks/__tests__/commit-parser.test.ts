import { describe, expect, it } from 'vitest'
import {
  extractTicketKeys,
  getTicketAction,
  parseCommitMessage,
  parseCommits,
  referencesTicket,
} from '../commit-parser'

describe('commit-parser', () => {
  describe('parseCommitMessage', () => {
    it('parses standalone ticket references', () => {
      const result = parseCommitMessage('Add feature for PUNT-123')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0]).toEqual({
        projectKey: 'PUNT',
        ticketNumber: 123,
        ticketKey: 'PUNT-123',
        action: 'reference',
      })
    })

    it('parses multiple ticket references', () => {
      const result = parseCommitMessage('PUNT-1 and PROJ-42 and BUG-999')

      expect(result.tickets).toHaveLength(3)
      expect(result.tickets.map((t) => t.ticketKey)).toEqual(['PUNT-1', 'PROJ-42', 'BUG-999'])
    })

    it('parses "fixes" pattern as close action', () => {
      const result = parseCommitMessage('fixes PUNT-123: resolve null pointer')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('close')
      expect(result.tickets[0].ticketKey).toBe('PUNT-123')
    })

    it('parses "closes" pattern as close action', () => {
      const result = parseCommitMessage('Feature complete, closes PUNT-456')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('close')
    })

    it('parses "resolves" pattern as close action', () => {
      const result = parseCommitMessage('resolves PUNT-789')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('close')
    })

    it('parses "wip" pattern as in_progress action', () => {
      const result = parseCommitMessage('wip PUNT-100: initial implementation')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('in_progress')
    })

    it('parses "working on" pattern as in_progress action', () => {
      const result = parseCommitMessage('working on PUNT-200')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('in_progress')
    })

    it('parses "refs" pattern as reference action', () => {
      const result = parseCommitMessage('refs PUNT-50')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('reference')
    })

    it('handles case insensitive keywords', () => {
      const result = parseCommitMessage('FIXES PUNT-1, Closes PUNT-2')

      expect(result.tickets).toHaveLength(2)
      expect(result.tickets[0].action).toBe('close')
      expect(result.tickets[1].action).toBe('close')
    })

    it('normalizes ticket keys to uppercase', () => {
      const result = parseCommitMessage('fixes punt-123')

      expect(result.tickets[0].ticketKey).toBe('PUNT-123')
      expect(result.tickets[0].projectKey).toBe('PUNT')
    })

    it('deduplicates ticket references', () => {
      const result = parseCommitMessage('PUNT-1 mentioned, then PUNT-1 again')

      expect(result.tickets).toHaveLength(1)
    })

    it('prioritizes action keywords over standalone mentions', () => {
      const result = parseCommitMessage('Working on PUNT-1, also PUNT-1 mentioned')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('in_progress')
    })

    it('handles empty messages', () => {
      const result = parseCommitMessage('')

      expect(result.tickets).toHaveLength(0)
    })

    it('handles messages without tickets', () => {
      const result = parseCommitMessage('Just a regular commit message')

      expect(result.tickets).toHaveLength(0)
    })

    it('handles project keys with varying lengths', () => {
      const result = parseCommitMessage('AB-1 and ABCDEFGHIJ-999')

      expect(result.tickets).toHaveLength(2)
      expect(result.tickets[0].projectKey).toBe('AB')
      expect(result.tickets[1].projectKey).toBe('ABCDEFGHIJ')
    })

    it('does not match single-letter project keys', () => {
      const result = parseCommitMessage('X-123 is not valid')

      expect(result.tickets).toHaveLength(0)
    })

    it('preserves original message', () => {
      const message = 'Original message with PUNT-1'
      const result = parseCommitMessage(message)

      expect(result.message).toBe(message)
    })

    it('handles multiline commit messages', () => {
      const message = `feat: add new feature

This commit fixes PUNT-123 and refs PUNT-456.

Also working on PUNT-789.`

      const result = parseCommitMessage(message)

      expect(result.tickets).toHaveLength(3)
      expect(result.tickets.find((t) => t.ticketKey === 'PUNT-123')?.action).toBe('close')
      expect(result.tickets.find((t) => t.ticketKey === 'PUNT-456')?.action).toBe('reference')
      expect(result.tickets.find((t) => t.ticketKey === 'PUNT-789')?.action).toBe('in_progress')
    })

    it('handles colon-prefixed keywords', () => {
      const result = parseCommitMessage('fix:fixes PUNT-123')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('close')
    })

    it('parses "completed" as close action', () => {
      const result = parseCommitMessage('completed PUNT-42')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('close')
    })

    it('parses "started" as in_progress action', () => {
      const result = parseCommitMessage('started PUNT-99')

      expect(result.tickets).toHaveLength(1)
      expect(result.tickets[0].action).toBe('in_progress')
    })
  })

  describe('parseCommits', () => {
    it('parses multiple commits', () => {
      const commits = [
        { message: 'fixes PUNT-1', sha: 'abc123' },
        { message: 'PUNT-2 mentioned', sha: 'def456' },
      ]

      const results = parseCommits(commits)

      expect(results).toHaveLength(2)
      expect(results[0].sha).toBe('abc123')
      expect(results[0].tickets[0].ticketKey).toBe('PUNT-1')
      expect(results[1].sha).toBe('def456')
    })

    it('preserves commit metadata', () => {
      const commits = [
        {
          message: 'PUNT-1',
          sha: 'abc123',
          author: 'Jane',
          timestamp: '2024-01-15T10:00:00Z',
          branch: 'main',
        },
      ]

      const results = parseCommits(commits)

      expect(results[0].sha).toBe('abc123')
      expect(results[0].author).toBe('Jane')
      expect(results[0].timestamp).toBe('2024-01-15T10:00:00Z')
      expect(results[0].branch).toBe('main')
    })
  })

  describe('extractTicketKeys', () => {
    it('extracts ticket keys from message', () => {
      const keys = extractTicketKeys('PUNT-1 and PROJ-2')

      expect(keys).toEqual(['PUNT-1', 'PROJ-2'])
    })

    it('returns empty array for no tickets', () => {
      const keys = extractTicketKeys('No tickets here')

      expect(keys).toEqual([])
    })
  })

  describe('referencesTicket', () => {
    it('returns true when ticket is referenced', () => {
      expect(referencesTicket('fixes PUNT-123', 'PUNT-123')).toBe(true)
    })

    it('returns false when ticket is not referenced', () => {
      expect(referencesTicket('fixes PUNT-123', 'PUNT-456')).toBe(false)
    })

    it('handles case insensitive matching', () => {
      expect(referencesTicket('fixes punt-123', 'PUNT-123')).toBe(true)
    })
  })

  describe('getTicketAction', () => {
    it('returns the action for a referenced ticket', () => {
      expect(getTicketAction('fixes PUNT-123', 'PUNT-123')).toBe('close')
      expect(getTicketAction('wip PUNT-456', 'PUNT-456')).toBe('in_progress')
      expect(getTicketAction('PUNT-789 mentioned', 'PUNT-789')).toBe('reference')
    })

    it('returns null for unreferenced ticket', () => {
      expect(getTicketAction('fixes PUNT-123', 'PUNT-999')).toBe(null)
    })
  })
})
