/**
 * Email message structure for sending
 */
export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

/**
 * Email provider interface - all providers must implement this
 */
export interface EmailProvider {
  /**
   * Send an email
   * @returns true if sent successfully, false otherwise
   */
  send(message: EmailMessage): Promise<boolean>

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean

  /**
   * Provider name for logging
   */
  readonly name: string
}

/**
 * Email template props shared by all templates
 */
export interface BaseEmailProps {
  appName?: string
  appUrl?: string
}

/**
 * Password reset email props
 */
export interface PasswordResetEmailProps extends BaseEmailProps {
  resetUrl: string
  userName?: string
  expiresInMinutes?: number
}

/**
 * Welcome email props
 */
export interface WelcomeEmailProps extends BaseEmailProps {
  userName: string
}

/**
 * Email verification props
 */
export interface EmailVerificationProps extends BaseEmailProps {
  verifyUrl: string
  userName?: string
  email: string
  expiresInMinutes?: number
}

/**
 * Project invitation email props
 */
export interface ProjectInvitationEmailProps extends BaseEmailProps {
  inviterName: string
  projectName: string
  inviteUrl: string
  role: string
  expiresInDays?: number
}

/**
 * Test email props
 */
export interface TestEmailProps extends BaseEmailProps {
  recipientEmail: string
}

/**
 * Supported email provider types
 */
export type EmailProviderType = 'none' | 'smtp' | 'resend' | 'console'

/**
 * Email settings from database
 */
export interface EmailSettings {
  emailEnabled: boolean
  emailProvider: EmailProviderType
  emailFromAddress: string
  emailFromName: string

  // SMTP settings
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpSecure: boolean

  // Feature toggles
  emailPasswordReset: boolean
  emailWelcome: boolean
  emailVerification: boolean
  emailInvitations: boolean
}

/**
 * Result of sending an email
 */
export interface SendEmailResult {
  success: boolean
  error?: string
  messageId?: string
}

/**
 * Sanitize an email display name to prevent header injection attacks.
 * Uses a whitelist approach - only allows safe characters:
 * - Alphanumeric (any language via Unicode Letter/Number categories)
 * - Common punctuation (spaces, hyphens, apostrophes, periods, commas)
 *
 * This prevents:
 * - Header injection (\r \n)
 * - Email address injection (< >)
 * - Quoted-string escaping (" \)
 * - Any other potentially dangerous characters
 *
 * @param name The display name to sanitize
 * @returns Sanitized display name safe for email headers
 */
export function sanitizeEmailDisplayName(name: string): string {
  if (!name) return ''

  // Normalize Unicode to NFC form for consistent handling
  const normalized = name.normalize('NFC')

  // Whitelist approach: only allow safe characters
  // - Unicode letters and numbers (supports international names)
  // - Common punctuation: space, hyphen, apostrophe, period, comma
  // This is safer than blacklisting dangerous characters
  const sanitized = normalized
    .replace(/[^\p{L}\p{N}\s\-'.,]/gu, '') // Keep only safe chars
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .slice(0, 100) // Enforce max length

  return sanitized
}
