import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

interface BaseLayoutProps {
  preview: string
  children: ReactNode
  appName?: string
  appUrl?: string
}

export function BaseLayout({ preview, children, appName = 'PUNT', appUrl }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>{appName}</Text>
          </Section>
          <Section style={content}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by {appName}
              {appUrl && (
                <>
                  {' '}
                  &bull;{' '}
                  <a href={appUrl} style={footerLink}>
                    {appUrl.replace(/^https?:\/\//, '')}
                  </a>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '24px 48px',
  borderBottom: '1px solid #e6ebf1',
}

const logo = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '0',
}

const content = {
  padding: '32px 48px',
}

const footer = {
  padding: '24px 48px',
  borderTop: '1px solid #e6ebf1',
}

const footerText = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0',
}

const footerLink = {
  color: '#8898aa',
  textDecoration: 'underline',
}
