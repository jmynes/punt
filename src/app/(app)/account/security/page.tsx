'use client'

import { UserCircle } from 'lucide-react'
import { Suspense } from 'react'
import { AccountTabs } from '@/components/account/account-tabs'
import { PageHeader } from '@/components/common'
import { SecurityTab } from '@/components/profile/security-tab'
import { useAccountUser } from '@/hooks/use-account-user'

export default function AccountSecurityPage() {
  return (
    <Suspense>
      <AccountSecurityContent />
    </Suspense>
  )
}

function AccountSecurityContent() {
  const { user, isDemo, handleUserUpdate, onSessionUpdate } = useAccountUser()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={UserCircle}
        category="Account"
        title="Security"
        description="Manage your email, password, and two-factor authentication"
        variant="hero"
        accentColor="blue"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <AccountTabs activeTab="security" />

        {user && (
          <SecurityTab
            user={user}
            isDemo={isDemo}
            onUserUpdate={handleUserUpdate}
            onSessionUpdate={onSessionUpdate}
          />
        )}
      </div>
    </div>
  )
}
