import type { Transporter } from 'nodemailer'
import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'
import type { EmailMessage, EmailProvider, EmailSettings } from '../types'

/**
 * SMTP email provider using Nodemailer
 */
export class SmtpProvider implements EmailProvider {
  readonly name = 'smtp'
  private transporter: Transporter | null = null
  private settings: EmailSettings

  constructor(settings: EmailSettings) {
    this.settings = settings
    this.initTransporter()
  }

  private initTransporter(): void {
    const password = process.env.EMAIL_SMTP_PASSWORD

    if (!this.settings.smtpHost || !password) {
      this.transporter = null
      return
    }

    this.transporter = nodemailer.createTransport({
      host: this.settings.smtpHost,
      port: this.settings.smtpPort,
      secure: this.settings.smtpSecure,
      auth: {
        user: this.settings.smtpUsername || this.settings.emailFromAddress,
        pass: password,
      },
    })
  }

  async send(message: EmailMessage): Promise<boolean> {
    if (!this.transporter) {
      logger.error('SMTP transporter not configured', new Error('Transporter is null'))
      return false
    }

    try {
      const from = this.settings.emailFromName
        ? `"${this.settings.emailFromName}" <${this.settings.emailFromAddress}>`
        : this.settings.emailFromAddress

      const result = await this.transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      })

      logger.info(`Email sent via SMTP: ${result.messageId}`)
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown SMTP error')
      logger.error('Failed to send email via SMTP', err)
      return false
    }
  }

  isConfigured(): boolean {
    return (
      !!this.settings.smtpHost &&
      !!this.settings.emailFromAddress &&
      !!process.env.EMAIL_SMTP_PASSWORD
    )
  }

  /**
   * Verify SMTP connection (useful for testing settings)
   */
  async verify(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP not configured' }
    }

    try {
      await this.transporter.verify()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }
}
