import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  generateToken,
  getExpirationDate,
  hashToken,
  isTokenExpired,
  TOKEN_EXPIRY,
  validateToken,
} from '../token'

describe('generateToken', () => {
  it('produces a base64url string with no padding or unsafe chars', () => {
    const token = generateToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces unique tokens', () => {
    expect(generateToken()).not.toBe(generateToken())
  })

  it('respects the byte-length argument', () => {
    // 8 bytes -> base64url length ~ ceil(8/3)*4 minus padding = 11 chars
    expect(generateToken(8).length).toBeLessThan(generateToken(32).length)
  })
})

describe('hashToken', () => {
  it('is a deterministic SHA-256 hex digest', () => {
    const expected = createHash('sha256').update('secret').digest('hex')
    expect(hashToken('secret')).toBe(expected)
    expect(hashToken('secret')).toBe(hashToken('secret'))
  })
})

describe('validateToken', () => {
  it('returns true for a matching token/hash pair', () => {
    const token = generateToken()
    expect(validateToken(token, hashToken(token))).toBe(true)
  })

  it('returns false for a non-matching token', () => {
    expect(validateToken('wrong', hashToken('right'))).toBe(false)
  })

  it('returns false when the hash length differs', () => {
    expect(validateToken('x', 'short')).toBe(false)
  })
})

describe('expiry helpers', () => {
  it('isTokenExpired distinguishes past and future dates', () => {
    expect(isTokenExpired(new Date(Date.now() - 1000))).toBe(true)
    expect(isTokenExpired(new Date(Date.now() + 100_000))).toBe(false)
  })

  it('getExpirationDate offsets from now by the given ms', () => {
    const before = Date.now()
    const exp = getExpirationDate(TOKEN_EXPIRY.PASSWORD_RESET)
    expect(exp.getTime()).toBeGreaterThanOrEqual(before + TOKEN_EXPIRY.PASSWORD_RESET - 50)
  })
})
