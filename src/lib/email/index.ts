/**
 * Main email module - provides unified email sending interface
 */

import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { logger } from '@/lib/logger'
import { ConsoleProvider } from './providers/console-provider'
import { NoopProvider } from './providers/noop-provider'
import { ResendProvider } from './providers/resend-provider'
import { SmtpProvider } from './providers/smtp-provider'
import { getAppName, getAppUrl, getEmailSettings } from './settings'
import { EmailVerificationEmail } from './templates/email-verification'
import { PasswordResetEmail } from './templates/password-reset'
import { TestEmail } from './templates/test-email'
import type {
  EmailMessage,
  EmailProvider,
  EmailSettings,
  EmailVerificationProps,
  PasswordResetEmailProps,
  SendEmailResult,
  TestEmailProps,
} from './types'

/**
 * Create an email provider based on settings
 */
function createProvider(settings: EmailSettings): EmailProvider {
  // In development, default to console provider for easier testing
  if (process.env.NODE_ENV === 'development' && settings.emailProvider === 'none') {
    return new ConsoleProvider()
  }

  switch (settings.emailProvider) {
    case 'smtp':
      return new SmtpProvider(settings)
    case 'resend':
      return new ResendProvider(settings)
    case 'console':
      return new ConsoleProvider()
    default:
      return new NoopProvider()
  }
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const settings = await getEmailSettings()

  if (!settings.emailEnabled) {
    logger.debug('Email is disabled, not sending')
    return { success: false, error: 'Email is disabled' }
  }

  const provider = createProvider(settings)

  if (!provider.isConfigured()) {
    logger.warn(`Email provider ${provider.name} is not properly configured`)
    return { success: false, error: `Provider ${provider.name} is not configured` }
  }

  try {
    const success = await provider.send(message)
    return { success }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error('Failed to send email', err)
    return { success: false, error: err.message }
  }
}

/**
 * Check if email is configured and ready to send
 */
export async function isEmailConfigured(): Promise<boolean> {
  const settings = await getEmailSettings()

  if (!settings.emailEnabled || settings.emailProvider === 'none') {
    return false
  }

  const provider = createProvider(settings)
  return provider.isConfigured()
}

/**
 * Render a React Email template to HTML string
 */
export async function renderTemplate(template: ReactElement): Promise<string> {
  return render(template)
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  props: Omit<PasswordResetEmailProps, 'appName' | 'appUrl'>,
): Promise<SendEmailResult> {
  const settings = await getEmailSettings()

  if (!settings.emailPasswordReset) {
    return { success: false, error: 'Password reset emails are disabled' }
  }

  const appName = getAppName()
  const appUrl = getAppUrl()

  const html = await renderTemplate(
    PasswordResetEmail({
      ...props,
      appName,
      appUrl,
    }),
  )

  return sendEmail({
    to,
    subject: `Reset your ${appName} password`,
    html,
  })
}

/**
 * Send an email verification email
 */
export async function sendVerificationEmail(
  to: string,
  props: Omit<EmailVerificationProps, 'appName' | 'appUrl'>,
): Promise<SendEmailResult> {
  const settings = await getEmailSettings()

  if (!settings.emailVerification) {
    return { success: false, error: 'Email verification is disabled' }
  }

  const appName = getAppName()
  const appUrl = getAppUrl()

  const html = await renderTemplate(
    EmailVerificationEmail({
      ...props,
      appName,
      appUrl,
    }),
  )

  return sendEmail({
    to,
    subject: `Verify your email for ${appName}`,
    html,
  })
}

/**
 * Send a test email (used by admin to verify configuration)
 */
export async function sendTestEmail(
  to: string,
  props?: Partial<TestEmailProps>,
): Promise<SendEmailResult> {
  const appName = getAppName()
  const appUrl = getAppUrl()

  const html = await renderTemplate(
    TestEmail({
      recipientEmail: to,
      appName,
      appUrl,
      ...props,
    }),
  )

  return sendEmail({
    to,
    subject: `Test email from ${appName}`,
    html,
  })
}

export {
  getAppName,
  getAppUrl,
  getEmailSettings,
  isEmailEnabled,
  isEmailFeatureEnabled,
} from './settings'
export * from './token'
// Re-export types and utilities
export * from './types'
