import { Button, Heading, Text } from '@react-email/components'
import type { PasswordResetEmailProps } from '../types'
import { BaseLayout } from './base-layout'

export function PasswordResetEmail({
  resetUrl,
  userName,
  expiresInMinutes = 60,
  appName = 'PUNT',
  appUrl,
}: PasswordResetEmailProps) {
  const previewText = `Reset your ${appName} password`

  return (
    <BaseLayout preview={previewText} appName={appName} appUrl={appUrl}>
      <Heading style={heading}>Reset your password</Heading>
      <Text style={paragraph}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>
      <Text style={paragraph}>
        We received a request to reset your password. Click the button below to choose a new
        password.
      </Text>
      <Button style={button} href={resetUrl}>
        Reset Password
      </Button>
      <Text style={paragraph}>
        This link will expire in {expiresInMinutes} minutes. If you didn&apos;t request a password
        reset, you can safely ignore this email.
      </Text>
      <Text style={smallText}>
        If the button doesn&apos;t work, copy and paste this URL into your browser:
      </Text>
      <Text style={linkText}>{resetUrl}</Text>
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

const button = {
  backgroundColor: '#1a1a1a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
  marginTop: '24px',
  marginBottom: '24px',
}

const smallText = {
  fontSize: '14px',
  color: '#8898aa',
  marginTop: '24px',
  marginBottom: '8px',
}

const linkText = {
  fontSize: '12px',
  color: '#8898aa',
  wordBreak: 'break-all' as const,
}

export default PasswordResetEmail
