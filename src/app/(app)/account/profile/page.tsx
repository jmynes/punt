'use client'

import { UserCircle } from 'lucide-react'
import { Suspense } from 'react'
import { AccountTabs } from '@/components/account/account-tabs'
import { PageHeader } from '@/components/common'
import { ProfileTab } from '@/components/profile/profile-tab'
import { useAccountUser } from '@/hooks/use-account-user'

export default function AccountProfilePage() {
  return (
    <Suspense>
      <AccountProfileContent />
    </Suspense>
  )
}

function AccountProfileContent() {
  const { user, isDemo, handleUserUpdate, onSessionUpdate } = useAccountUser()

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        icon={UserCircle}
        category="Account"
        title="Profile"
        description="Manage your name, avatar, and display preferences"
        variant="hero"
        accentColor="blue"
      />

      <div className="mx-auto max-w-4xl px-6 pb-6">
        <AccountTabs activeTab="profile" />

        {user && (
          <ProfileTab
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
