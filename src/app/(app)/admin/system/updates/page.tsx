'use client'

import { Settings } from 'lucide-react'
import { AdminSystemTabs } from '@/components/admin/admin-system-tabs'
import { RepositorySettingsForm } from '@/components/admin/repository-settings-form'
import { PageHeader } from '@/components/common'

export default function AdminUpdatesSettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={Settings}
        category="Admin"
        title="System Settings"
        description="Configure branding, database, email, uploads, and updates"
        variant="hero"
        accentColor="amber"
      />
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 overflow-auto">
        <AdminSystemTabs activeTab="updates" />
        <RepositorySettingsForm />
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
