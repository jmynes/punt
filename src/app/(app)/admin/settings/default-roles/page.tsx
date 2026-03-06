'use client'

import { Settings } from 'lucide-react'
import { AdminSettingsTabs } from '@/components/admin/admin-settings-tabs'
import { RolePermissionsForm } from '@/components/admin/role-permissions-form'
import { PageHeader } from '@/components/common'

export default function AdminRolesSettingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={Settings}
        category="Admin"
        title="System Settings"
        description="Configure uploads, branding, roles, and database options"
        variant="hero"
        accentColor="amber"
      />
      <div className="flex-1 flex flex-col min-h-0 mx-auto w-full max-w-4xl px-6 overflow-auto">
        <AdminSettingsTabs activeTab="default-roles" />
        <RolePermissionsForm />
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  )
}
