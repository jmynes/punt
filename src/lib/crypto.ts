/**
 * Cryptographic utilities for database backup encryption
 *
 * Uses AES-256-GCM with PBKDF2 key derivation for password-based encryption.
 * This provides authenticated encryption, preventing tampering with ciphertext.
 */

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'

// Encryption parameters
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits for GCM
const SALT_LENGTH = 32 // 256 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_DIGEST = 'sha256'

export interface EncryptedData {
  ciphertext: string // base64
  salt: string // base64
  iv: string // base64
  authTag: string // base64
}

/**
 * Derives an encryption key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
}

/**
 * Encrypts data using AES-256-GCM with PBKDF2 key derivation
 *
 * @param plaintext - The data to encrypt (string)
 * @param password - The password to derive the encryption key from
 * @returns EncryptedData object with base64-encoded fields
 */
export function encrypt(plaintext: string, password: string): EncryptedData {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)

  // Derive key from password
  const key = deriveKey(password, salt)

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

/**
 * Decrypts data that was encrypted with the encrypt function
 *
 * @param encryptedData - The EncryptedData object from encrypt()
 * @param password - The password used for encryption
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (wrong password or tampered data)
 */
export function decrypt(encryptedData: EncryptedData, password: string): string {
  // Decode base64 values
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64')
  const salt = Buffer.from(encryptedData.salt, 'base64')
  const iv = Buffer.from(encryptedData.iv, 'base64')
  const authTag = Buffer.from(encryptedData.authTag, 'base64')

  // Derive key from password
  const key = deriveKey(password, salt)

  // Create decipher and decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('Decryption failed: incorrect password or corrupted data')
  }
}

/**
 * Checks if data appears to be encrypted (has all required fields)
 */
export function isEncryptedData(data: unknown): data is EncryptedData {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.ciphertext === 'string' &&
    typeof obj.salt === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.authTag === 'string'
  )
}
