import Link from 'next/link'
import { AuthBranding } from '@/components/auth/auth-branding'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <AuthBranding
        title="Reset your password"
        subtitle="Enter your email to receive a reset link"
      />
      <ForgotPasswordForm />
      <p className="text-center text-sm text-zinc-500">
        Remember your password?{' '}
        <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
