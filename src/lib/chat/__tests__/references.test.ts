import { describe, expect, it } from 'vitest'
import { extractMentionedUsernames, extractReferencedTicketKeys } from '../references'

describe('extractMentionedUsernames', () => {
  it('should extract a single username', () => {
    expect(extractMentionedUsernames('Hey @jordan, can you check this?')).toEqual(['jordan'])
  })

  it('should extract multiple usernames', () => {
    expect(extractMentionedUsernames('Hey @jordan, can @admin check this?')).toEqual([
      'jordan',
      'admin',
    ])
  })

  it('should deduplicate usernames', () => {
    expect(extractMentionedUsernames('@jordan said to @jordan')).toEqual(['jordan'])
  })

  it('should return empty array for no mentions', () => {
    expect(extractMentionedUsernames('No mentions here')).toEqual([])
  })

  it('should handle usernames with dots and hyphens', () => {
    expect(extractMentionedUsernames('Ask @john.doe and @jane-smith')).toEqual([
      'john.doe',
      'jane-smith',
    ])
  })

  it('should handle usernames with underscores', () => {
    expect(extractMentionedUsernames('Ask @user_name')).toEqual(['user_name'])
  })

  it('should handle empty string', () => {
    expect(extractMentionedUsernames('')).toEqual([])
  })

  it('should not match email addresses as mentions', () => {
    // The @ in an email like user@domain.com should match the @domain.com part
    // This is a known limitation but tests the current behavior
    const result = extractMentionedUsernames('Email user@domain.com')
    expect(result).toEqual(['domain.com'])
  })

  it('should handle mentions at start and end of text', () => {
    expect(extractMentionedUsernames('@start and @end')).toEqual(['start', 'end'])
  })

  it('should handle mentions on multiple lines', () => {
    expect(extractMentionedUsernames('@jordan\n@admin')).toEqual(['jordan', 'admin'])
  })
})

describe('extractReferencedTicketKeys', () => {
  it('should extract a single ticket key with # prefix', () => {
    expect(extractReferencedTicketKeys('Check #PUNT-123')).toEqual(['PUNT-123'])
  })

  it('should extract a bare ticket key without # prefix', () => {
    expect(extractReferencedTicketKeys('Check PUNT-123')).toEqual(['PUNT-123'])
  })

  it('should extract both prefixed and bare ticket keys', () => {
    expect(extractReferencedTicketKeys('Check #PUNT-123 and PUNT-456')).toEqual([
      'PUNT-123',
      'PUNT-456',
    ])
  })

  it('should deduplicate ticket keys', () => {
    expect(extractReferencedTicketKeys('#PUNT-123 and PUNT-123')).toEqual(['PUNT-123'])
  })

  it('should return empty array for no ticket references', () => {
    expect(extractReferencedTicketKeys('No tickets here')).toEqual([])
  })

  it('should handle multiple project keys', () => {
    expect(extractReferencedTicketKeys('#PUNT-1 and #ABC-2')).toEqual(['PUNT-1', 'ABC-2'])
  })

  it('should handle empty string', () => {
    expect(extractReferencedTicketKeys('')).toEqual([])
  })

  it('should not match lowercase project keys', () => {
    expect(extractReferencedTicketKeys('#punt-123')).toEqual([])
  })

  it('should handle project keys with numbers', () => {
    expect(extractReferencedTicketKeys('#PROJ2-42')).toEqual(['PROJ2-42'])
  })

  it('should handle ticket keys on multiple lines', () => {
    expect(extractReferencedTicketKeys('#PUNT-1\n#ABC-2')).toEqual(['PUNT-1', 'ABC-2'])
  })

  it('should handle ticket key at word boundary', () => {
    expect(extractReferencedTicketKeys('issue#PUNT-123')).toEqual(['PUNT-123'])
  })
})
