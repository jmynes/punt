import { Suspense } from 'react'
import { AuthBranding } from '@/components/auth/auth-branding'
import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export default function VerifyEmailPage() {
  return (
    <div className="space-y-6">
      <AuthBranding title="Email Verification" subtitle="Verifying your email address" />
      <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  )
}
