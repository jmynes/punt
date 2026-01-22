import { Suspense } from 'react'
import { AuthBranding } from '@/components/auth/auth-branding'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <AuthBranding title="Create new password" subtitle="Enter your new password below" />
      <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
