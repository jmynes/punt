import type { ReactNode } from 'react'
import { ChatFAB, ChatPanel } from '@/components/chat'
import { EmailVerificationBanner } from '@/components/common/email-verification-banner'
import { RoleSimulationBanner } from '@/components/common/role-simulation-banner'
import { SearchClearOnLeave } from '@/components/common/search-clear-on-leave'
import { Dialogs } from '@/components/dialogs'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { Footer, Header, MobileNav, MobileNotice, Sidebar } from '@/components/layout'
import { SelectionIndicator } from '@/components/selection-indicator'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <EmailVerificationBanner />
      <RoleSimulationBanner />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">{children}</div>
          <Footer />
        </main>
      </div>
      <MobileNav />
      <MobileNotice />
      <Dialogs />
      <KeyboardShortcuts />
      <SelectionIndicator />
      <ChatPanel />
      <ChatFAB />
      <SearchClearOnLeave />
    </div>
  )
}
