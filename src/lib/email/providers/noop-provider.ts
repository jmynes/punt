import type { EmailMessage, EmailProvider } from '../types'

/**
 * No-op email provider - silently discards emails
 * Used when email is not configured
 */
export class NoopProvider implements EmailProvider {
  readonly name = 'noop'

  async send(_message: EmailMessage): Promise<boolean> {
    // Silently discard - email not configured
    return false
  }

  isConfigured(): boolean {
    return false
  }
}
