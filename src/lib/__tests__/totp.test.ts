import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countRemainingRecoveryCodes,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpKeyUri,
  generateTotpSecret,
  hashRecoveryCodes,
  isTotpReplay,
  markRecoveryCodeUsed,
  reencryptTotpSecret,
  verifyRecoveryCode,
  verifyTotpToken,
} from '../totp'

// Deterministic, fast password hashing for the recovery-code tests.
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async (s: string) => `hashed:${s}`),
  verifyPassword: vi.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
}))

beforeEach(() => {
  vi.stubEnv('AUTH_SECRET', 'test-auth-secret-value')
})
afterEach(() => vi.unstubAllEnvs())

describe('TOTP secret encryption', () => {
  it('round-trips a secret through encrypt/decrypt', () => {
    const enc = encryptTotpSecret('JBSWY3DPEHPK3PXP')
    expect(enc.split(':')).toHaveLength(3)
    expect(decryptTotpSecret(enc)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptTotpSecret('SECRET')).not.toBe(encryptTotpSecret('SECRET'))
  })

  it('throws without AUTH_SECRET', () => {
    vi.stubEnv('AUTH_SECRET', '')
    expect(() => encryptTotpSecret('SECRET')).toThrow(/AUTH_SECRET/)
  })

  it('rejects a malformed encrypted secret', () => {
    expect(() => decryptTotpSecret('not-valid')).toThrow(/Invalid encrypted TOTP secret format/)
  })

  it('reencrypts from an old AUTH_SECRET to the current one', () => {
    const oldKeyEnc = (() => {
      vi.stubEnv('AUTH_SECRET', 'old-secret')
      return encryptTotpSecret('PORTABLE')
    })()
    vi.stubEnv('AUTH_SECRET', 'new-secret')
    const reenc = reencryptTotpSecret(oldKeyEnc, 'old-secret')
    expect(decryptTotpSecret(reenc)).toBe('PORTABLE')
  })

  it('reencrypt rejects a malformed secret', () => {
    expect(() => reencryptTotpSecret('bad', 'old')).toThrow(/Invalid encrypted TOTP secret format/)
  })
})

describe('TOTP secret + URI generation', () => {
  it('generates a non-empty secret', () => {
    expect(generateTotpSecret().length).toBeGreaterThan(0)
  })

  it('builds a key URI containing the issuer, label and secret', () => {
    const uri = generateTotpKeyUri('JBSWY3DPEHPK3PXP', 'alice', 'PUNT')
    expect(uri).toContain('otpauth://')
    expect(uri).toContain('PUNT')
    expect(uri).toContain('alice')
  })

  it('rejects an obviously-wrong token', () => {
    expect(verifyTotpToken('000000', generateTotpSecret())).toBe(false)
  })
})

describe('isTotpReplay', () => {
  it('is false when there is no prior use', () => {
    expect(isTotpReplay(null)).toBe(false)
    expect(isTotpReplay(undefined)).toBe(false)
  })

  it('is true within the same 30s window and false outside it', () => {
    expect(isTotpReplay(new Date())).toBe(true)
    expect(isTotpReplay(new Date(Date.now() - 60_000))).toBe(false)
  })
})

describe('recovery codes', () => {
  it('generates codes in XXXXX-XXXXX format', () => {
    const codes = generateRecoveryCodes(3)
    expect(codes).toHaveLength(3)
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/)
    }
  })

  it('hashes each code', async () => {
    const hashed = await hashRecoveryCodes(['ABCDE-12345'])
    expect(hashed).toEqual(['hashed:ABCDE-12345'])
  })

  it('verifyRecoveryCode returns the matching index, skipping used codes', async () => {
    const stored = ['', 'hashed:GOOD-CODE0', 'hashed:OTHER-CODE1']
    expect(await verifyRecoveryCode('GOOD-CODE0', stored)).toBe(1)
    expect(await verifyRecoveryCode('NOPE', stored)).toBe(-1)
  })

  it('verifyRecoveryCode coerces a legacy JSON-string array', async () => {
    const stored = JSON.stringify(['hashed:GOOD-CODE0'])
    expect(await verifyRecoveryCode('GOOD-CODE0', stored)).toBe(0)
  })

  it('markRecoveryCodeUsed clears the code at the index', () => {
    const updated = markRecoveryCodeUsed(['a', 'b', 'c'], 1)
    expect(updated).toEqual(['a', '', 'c'])
  })

  it('countRemainingRecoveryCodes counts the unused codes', () => {
    expect(countRemainingRecoveryCodes(['a', '', 'c'])).toBe(2)
    expect(countRemainingRecoveryCodes('garbage')).toBe(0)
  })
})
