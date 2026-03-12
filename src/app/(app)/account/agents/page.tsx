'use client'

import { UserCircle } from 'lucide-react'
import { Suspense } from 'react'
import { AccountTabs } from '@/components/account/account-tabs'
import { PageHeader } from '@/components/common'
import { MCPTab } from '@/components/profile/mcp-tab'
import { isDemoMode } from '@/lib/demo'

export default function AccountAgentsPage() {
  return (
    <Suspense>
      <AccountAgentsContent />
    </Suspense>
  )
}

function AccountAgentsContent() {
  const isDemo = isDemoMode()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={UserCircle}
        category="Account"
        title="Agents"
        description="Manage your MCP API key and AI agents"
        variant="hero"
        accentColor="blue"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <AccountTabs activeTab="agents" />
        <MCPTab isDemo={isDemo} />
      </div>
    </div>
  )
}
