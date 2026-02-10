import { describe, expect, it } from 'vitest'
import {
  getProjectKeyFromTicketKey,
  getTicketReferencePath,
  linkifyTicketReferences,
  parseTicketReferences,
} from '../ticket-references'

describe('parseTicketReferences', () => {
  it('should return plain text when no ticket references', () => {
    const result = parseTicketReferences('No ticket references here')
    expect(result).toEqual([{ text: 'No ticket references here', ticketKey: null }])
  })

  it('should parse a single ticket reference', () => {
    const result = parseTicketReferences('See PUNT-123')
    expect(result).toEqual([
      { text: 'See ', ticketKey: null },
      { text: 'PUNT-123', ticketKey: 'PUNT-123' },
    ])
  })

  it('should parse multiple ticket references', () => {
    const result = parseTicketReferences('See PUNT-123 and ABC-1 for details')
    expect(result).toEqual([
      { text: 'See ', ticketKey: null },
      { text: 'PUNT-123', ticketKey: 'PUNT-123' },
      { text: ' and ', ticketKey: null },
      { text: 'ABC-1', ticketKey: 'ABC-1' },
      { text: ' for details', ticketKey: null },
    ])
  })

  it('should parse ticket reference at start of text', () => {
    const result = parseTicketReferences('PUNT-1 is done')
    expect(result).toEqual([
      { text: 'PUNT-1', ticketKey: 'PUNT-1' },
      { text: ' is done', ticketKey: null },
    ])
  })

  it('should parse ticket reference at end of text', () => {
    const result = parseTicketReferences('Related to PUNT-42')
    expect(result).toEqual([
      { text: 'Related to ', ticketKey: null },
      { text: 'PUNT-42', ticketKey: 'PUNT-42' },
    ])
  })

  it('should handle ticket reference that is the entire text', () => {
    const result = parseTicketReferences('PUNT-123')
    expect(result).toEqual([{ text: 'PUNT-123', ticketKey: 'PUNT-123' }])
  })

  it('should handle empty string', () => {
    const result = parseTicketReferences('')
    expect(result).toEqual([{ text: '', ticketKey: null }])
  })

  it('should handle project keys with numbers', () => {
    const result = parseTicketReferences('See PROJ2-42')
    expect(result).toEqual([
      { text: 'See ', ticketKey: null },
      { text: 'PROJ2-42', ticketKey: 'PROJ2-42' },
    ])
  })

  it('should not match lowercase project keys', () => {
    const result = parseTicketReferences('See punt-123')
    expect(result).toEqual([{ text: 'See punt-123', ticketKey: null }])
  })

  it('should not match single-letter project keys', () => {
    // Single letter followed by digit and dash doesn't match because
    // the pattern requires at least 2 characters before the dash
    const result = parseTicketReferences('See A-123')
    expect(result).toEqual([{ text: 'See A-123', ticketKey: null }])
  })
})

describe('getProjectKeyFromTicketKey', () => {
  it('should extract project key from ticket key', () => {
    expect(getProjectKeyFromTicketKey('PUNT-123')).toBe('PUNT')
  })

  it('should handle project keys with numbers', () => {
    expect(getProjectKeyFromTicketKey('PROJ2-42')).toBe('PROJ2')
  })

  it('should handle single digit ticket numbers', () => {
    expect(getProjectKeyFromTicketKey('ABC-1')).toBe('ABC')
  })
})

describe('getTicketReferencePath', () => {
  it('should build correct URL path', () => {
    expect(getTicketReferencePath('PUNT-123')).toBe('/projects/PUNT/PUNT-123')
  })

  it('should handle different project keys', () => {
    expect(getTicketReferencePath('ABC-1')).toBe('/projects/ABC/ABC-1')
  })
})

describe('linkifyTicketReferences', () => {
  it('should convert ticket references to markdown links', () => {
    const result = linkifyTicketReferences('See PUNT-123 for details')
    expect(result).toBe('See [PUNT-123](/projects/PUNT/PUNT-123) for details')
  })

  it('should handle multiple references', () => {
    const result = linkifyTicketReferences('PUNT-1 blocks ABC-2')
    expect(result).toBe('[PUNT-1](/projects/PUNT/PUNT-1) blocks [ABC-2](/projects/ABC/ABC-2)')
  })

  it('should not linkify references inside inline code', () => {
    const result = linkifyTicketReferences('See `PUNT-123` in code')
    expect(result).toBe('See `PUNT-123` in code')
  })

  it('should not linkify references inside code blocks', () => {
    const input = '```\nPUNT-123\n```'
    const result = linkifyTicketReferences(input)
    expect(result).toBe('```\nPUNT-123\n```')
  })

  it('should not linkify references inside existing markdown links', () => {
    const result = linkifyTicketReferences('See [PUNT-123](http://example.com)')
    expect(result).toBe('See [PUNT-123](http://example.com)')
  })

  it('should not linkify references inside URLs', () => {
    const result = linkifyTicketReferences('See https://example.com/PUNT-123')
    expect(result).toBe('See https://example.com/PUNT-123')
  })

  it('should handle empty string', () => {
    expect(linkifyTicketReferences('')).toBe('')
  })

  it('should handle text with no references', () => {
    expect(linkifyTicketReferences('Just plain text')).toBe('Just plain text')
  })

  it('should handle multiline markdown', () => {
    const input = 'First line with PUNT-1\n\nSecond line with ABC-2'
    const result = linkifyTicketReferences(input)
    expect(result).toBe(
      'First line with [PUNT-1](/projects/PUNT/PUNT-1)\n\nSecond line with [ABC-2](/projects/ABC/ABC-2)',
    )
  })

  it('should handle mixed content: code blocks and regular text', () => {
    const input = 'See PUNT-1\n```\nPUNT-2 in code\n```\nAlso PUNT-3'
    const result = linkifyTicketReferences(input)
    expect(result).toBe(
      'See [PUNT-1](/projects/PUNT/PUNT-1)\n```\nPUNT-2 in code\n```\nAlso [PUNT-3](/projects/PUNT/PUNT-3)',
    )
  })

  it('should not double-linkify already linked references', () => {
    const input = 'See [PUNT-123](/projects/PUNT/PUNT-123) and PUNT-456'
    const result = linkifyTicketReferences(input)
    expect(result).toBe(
      'See [PUNT-123](/projects/PUNT/PUNT-123) and [PUNT-456](/projects/PUNT/PUNT-456)',
    )
  })
})
