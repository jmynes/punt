import { Resend } from 'resend'
import { logger } from '@/lib/logger'
import type { EmailMessage, EmailProvider, EmailSettings } from '../types'
import { sanitizeEmailDisplayName } from '../types'

/**
 * Resend email provider
 * API key must be set via EMAIL_RESEND_API_KEY environment variable
 */
export class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  private client: Resend | null = null
  private settings: EmailSettings

  constructor(settings: EmailSettings) {
    this.settings = settings
    this.initClient()
  }

  private initClient(): void {
    const apiKey = process.env.EMAIL_RESEND_API_KEY

    if (!apiKey) {
      this.client = null
      return
    }

    this.client = new Resend(apiKey)
  }

  async send(message: EmailMessage): Promise<boolean> {
    if (!this.client) {
      logger.error('Resend client not configured', new Error('Client is null'))
      return false
    }

    try {
      const sanitizedName = sanitizeEmailDisplayName(this.settings.emailFromName)
      // Quote the display name for RFC 5322 compliance and consistency with SMTP
      const from = sanitizedName
        ? `"${sanitizedName}" <${this.settings.emailFromAddress}>`
        : this.settings.emailFromAddress

      const { data, error } = await this.client.emails.send({
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      })

      if (error) {
        logger.error('Resend API error', new Error(error.message))
        return false
      }

      logger.info(`Email sent via Resend: ${data?.id}`)
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown Resend error')
      logger.error('Failed to send email via Resend', err)
      return false
    }
  }

  isConfigured(): boolean {
    return !!process.env.EMAIL_RESEND_API_KEY && !!this.settings.emailFromAddress
  }
}
