import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Dialogs } from '@/components/dialogs'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Header, MobileNav, Sidebar } from '@/components/layout'
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
			<body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
				<Providers>
					<div className="relative min-h-screen bg-zinc-950">
						<Header />
						<div className="flex">
							<Sidebar />
							<main className="flex-1 overflow-hidden">{children}</main>
						</div>
						<MobileNav />
						<Dialogs />
						<KeyboardShortcuts />
						<Toaster position="top-right" />
					</div>
				</Providers>
			</body>
		</html>
	)
}
