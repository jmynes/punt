import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Reset your password</h1>
        <p className="text-zinc-500">Enter your email to receive a reset link</p>
      </div>
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
