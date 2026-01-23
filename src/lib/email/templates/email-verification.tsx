import { Button, Heading, Text } from '@react-email/components'
import type { EmailVerificationProps } from '../types'
import { BaseLayout } from './base-layout'

export function EmailVerificationEmail({
  verifyUrl,
  userName,
  email,
  expiresInMinutes = 1440, // 24 hours
  appName = 'PUNT',
  appUrl,
}: EmailVerificationProps) {
  const previewText = `Verify your email for ${appName}`
  const expiresInHours = Math.round(expiresInMinutes / 60)

  return (
    <BaseLayout preview={previewText} appName={appName} appUrl={appUrl}>
      <Heading style={heading}>Verify your email address</Heading>
      <Text style={paragraph}>{userName ? `Hi ${userName},` : 'Hi,'}</Text>
      <Text style={paragraph}>
        Please verify that <strong>{email}</strong> is your email address by clicking the button
        below.
      </Text>
      <Button style={button} href={verifyUrl}>
        Verify Email Address
      </Button>
      <Text style={paragraph}>
        This link will expire in {expiresInHours} hours. If you didn&apos;t create an account or
        request this verification, you can safely ignore this email.
      </Text>
      <Text style={smallText}>
        If the button doesn&apos;t work, copy and paste this URL into your browser:
      </Text>
      <Text style={linkText}>{verifyUrl}</Text>
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

export default EmailVerificationEmail
