import { Suspense } from 'react'
import { AuthBranding } from '@/components/auth/auth-branding'
import { SetupForm } from '@/components/auth/setup-form'

export default function SetupPage() {
  return (
    <div className="space-y-6">
      <AuthBranding subtitle="First-time setup" />
      <Suspense fallback={<div className="h-96 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <SetupForm />
      </Suspense>
    </div>
  )
}
