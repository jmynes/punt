'use client'

import { UserCircle } from 'lucide-react'
import { Suspense } from 'react'
import { AccountTabs } from '@/components/account/account-tabs'
import { PageHeader } from '@/components/common'
import { ClaudeChatTab } from '@/components/profile/claude-chat-tab'
import { isDemoMode } from '@/lib/demo'

export default function AccountClaudeChatPage() {
  return (
    <Suspense>
      <AccountClaudeChatContent />
    </Suspense>
  )
}

function AccountClaudeChatContent() {
  const isDemo = isDemoMode()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={UserCircle}
        category="Account"
        title="Claude Chat"
        description="Configure your AI chat provider and API key"
        variant="hero"
        accentColor="blue"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <AccountTabs activeTab="claude-chat" />
        <ClaudeChatTab isDemo={isDemo} />
      </div>
    </div>
  )
}
