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

export const metadata: Metadata = {
  title: 'PUNT - Simple Kanban & Ticket Tracker',
  description:
    'A lightweight, self-hosted ticket tracker and kanban board. Jira-like without the bloat.',
  icons: {
    icon: '/favicon.ico',
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-zinc-950`}
      >
        <Providers>
          <DemoBanner />
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
