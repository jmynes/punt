'use client'

import { Info, Layers } from 'lucide-react'
import { AdminDefaultsTabs } from '@/components/admin/admin-defaults-tabs'
import { RolePermissionsForm } from '@/components/admin/role-permissions-form'
import { PageHeader } from '@/components/common'

export default function AdminRolesDefaultsPage() {
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
        <AdminDefaultsTabs activeTab="roles" />
        <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-blue-950/30 border border-blue-900/50">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200/80">
            <p className="font-medium text-blue-200 mb-1">Default settings for new projects</p>
            <p>
              These default roles are applied when new projects are created. Individual projects can
              customize their roles independently. Existing projects are not affected.
            </p>
          </div>
        </div>
        <RolePermissionsForm />
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
