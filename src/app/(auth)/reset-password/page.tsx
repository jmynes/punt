import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Create new password</h1>
        <p className="text-zinc-500">Enter your new password below</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
