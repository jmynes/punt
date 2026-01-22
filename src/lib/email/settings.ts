/**
 * Email settings helper for fetching email configuration from database.
 */

import { db } from '@/lib/db'
import type { EmailProviderType, EmailSettings } from './types'

// Default email settings
const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  emailEnabled: false,
  emailProvider: 'none',
  emailFromAddress: '',
  emailFromName: 'PUNT',
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  smtpSecure: true,
  emailPasswordReset: true,
  emailWelcome: false,
  emailVerification: false,
  emailInvitations: true,
}

/**
 * Validate that a string is a valid email provider type
 */
function isValidProvider(provider: string): provider is EmailProviderType {
  return ['none', 'smtp', 'resend', 'console'].includes(provider)
}

/**
 * Fetch email settings from database.
 * Returns parsed settings with defaults for missing values.
 */
export async function getEmailSettings(): Promise<EmailSettings> {
  const settings = await db.systemSettings.upsert({
    where: { id: 'system-settings' },
    update: {},
    create: { id: 'system-settings' },
  })

  const provider = isValidProvider(settings.emailProvider)
    ? settings.emailProvider
    : DEFAULT_EMAIL_SETTINGS.emailProvider

  return {
    emailEnabled: settings.emailEnabled,
    emailProvider: provider,
    emailFromAddress: settings.emailFromAddress || DEFAULT_EMAIL_SETTINGS.emailFromAddress,
    emailFromName: settings.emailFromName || DEFAULT_EMAIL_SETTINGS.emailFromName,
    smtpHost: settings.smtpHost || DEFAULT_EMAIL_SETTINGS.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUsername: settings.smtpUsername || DEFAULT_EMAIL_SETTINGS.smtpUsername,
    smtpSecure: settings.smtpSecure,
    emailPasswordReset: settings.emailPasswordReset,
    emailWelcome: settings.emailWelcome,
    emailVerification: settings.emailVerification,
    emailInvitations: settings.emailInvitations,
  }
}

/**
 * Check if email is configured and enabled
 */
export async function isEmailEnabled(): Promise<boolean> {
  const settings = await getEmailSettings()
  return settings.emailEnabled && settings.emailProvider !== 'none'
}

/**
 * Check if a specific email feature is enabled
 */
export async function isEmailFeatureEnabled(
  feature: 'passwordReset' | 'welcome' | 'verification' | 'invitations',
): Promise<boolean> {
  const settings = await getEmailSettings()

  if (!settings.emailEnabled || settings.emailProvider === 'none') {
    return false
  }

  switch (feature) {
    case 'passwordReset':
      return settings.emailPasswordReset
    case 'welcome':
      return settings.emailWelcome
    case 'verification':
      return settings.emailVerification
    case 'invitations':
      return settings.emailInvitations
    default:
      return false
  }
}

/**
 * Get the application URL from environment
 */
export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

/**
 * Get the application name from environment or default
 */
export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || 'PUNT'
}
