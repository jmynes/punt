import type { ReactNode } from 'react'
import { Dialogs } from '@/components/dialogs'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Footer, Header, MobileNav, Sidebar } from '@/components/layout'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">{children}</div>
          <Footer />
        </main>
      </div>
      <MobileNav />
      <Dialogs />
      <KeyboardShortcuts />
    </div>
  )
}
