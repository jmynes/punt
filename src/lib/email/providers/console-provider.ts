import { logger } from '@/lib/logger'
import type { EmailMessage, EmailProvider } from '../types'

/**
 * Console email provider - logs emails to console
 * Useful for development and testing
 */
export class ConsoleProvider implements EmailProvider {
  readonly name = 'console'

  async send(message: EmailMessage): Promise<boolean> {
    const recipients = Array.isArray(message.to) ? message.to.join(', ') : message.to

    logger.info('='.repeat(60))
    logger.info('EMAIL SENT (Console Provider)')
    logger.info('='.repeat(60))
    logger.info(`To: ${recipients}`)
    logger.info(`Subject: ${message.subject}`)
    if (message.replyTo) {
      logger.info(`Reply-To: ${message.replyTo}`)
    }
    logger.info('-'.repeat(60))
    logger.info('HTML Content:')
    logger.info(message.html)
    if (message.text) {
      logger.info('-'.repeat(60))
      logger.info('Plain Text Content:')
      logger.info(message.text)
    }
    logger.info('='.repeat(60))

    return true
  }

  isConfigured(): boolean {
    return true
  }
}
