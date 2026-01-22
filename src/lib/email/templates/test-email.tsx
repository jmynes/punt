import { Heading, Text } from '@react-email/components'
import type { TestEmailProps } from '../types'
import { BaseLayout } from './base-layout'

export function TestEmail({ recipientEmail, appName = 'PUNT', appUrl }: TestEmailProps) {
  const previewText = `Test email from ${appName}`

  return (
    <BaseLayout preview={previewText} appName={appName} appUrl={appUrl}>
      <Heading style={heading}>Test Email</Heading>
      <Text style={paragraph}>
        This is a test email to verify that your email configuration is working correctly.
      </Text>
      <Text style={paragraph}>
        <strong>Recipient:</strong> {recipientEmail}
      </Text>
      <Text style={paragraph}>
        <strong>Sent at:</strong> {new Date().toISOString()}
      </Text>
      <Text style={successText}>
        If you&apos;re reading this, your email configuration is working!
      </Text>
    </BaseLayout>
  )
}

const heading = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  marginBottom: '24px',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#525f7f',
  marginBottom: '16px',
}

const successText = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#32936f',
  fontWeight: 'bold' as const,
  marginTop: '24px',
  padding: '16px',
  backgroundColor: '#e6f7ef',
  borderRadius: '6px',
}

export default TestEmail
