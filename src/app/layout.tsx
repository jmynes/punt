import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { DemoBanner } from '@/components/demo'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Absolute base for og:image and other social metadata. Baked at build
// time, so it must come from env, not request headers. Falls back to
// Railway's auto-provided domain, then to Next's localhost default.
const appUrl =
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined)

export const metadata: Metadata = {
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  title: 'PUNT - Simple Kanban & Ticket Tracker',
  description:
    'A lightweight, self-hosted ticket tracker and kanban board. Jira-like without the bloat.',
  icons: {
    icon: [{ url: 'data:,', type: 'image/x-icon' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-zinc-950 h-screen flex flex-col overflow-hidden`}
      >
        <Providers>
          <DemoBanner />
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
