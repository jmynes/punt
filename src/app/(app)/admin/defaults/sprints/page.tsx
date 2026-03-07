'use client'

import { Layers } from 'lucide-react'
import { AdminDefaultsTabs } from '@/components/admin/admin-defaults-tabs'
import { SprintSettingsForm } from '@/components/admin/sprint-settings-form'
import { PageHeader } from '@/components/common'

export default function AdminSprintsDefaultsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={Layers}
        category="Admin"
        title="Project Defaults"
        description="Configure default settings inherited by new projects"
        variant="hero"
        accentColor="amber"
      />
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 overflow-auto">
        <AdminDefaultsTabs activeTab="sprints" />
        <SprintSettingsForm />
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
