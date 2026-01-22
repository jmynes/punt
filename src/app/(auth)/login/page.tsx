import Link from 'next/link'
import { Suspense } from 'react'
import { AuthBranding } from '@/components/auth/auth-branding'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <AuthBranding subtitle="Sign in to your account" />
      <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <LoginForm />
      </Suspense>
      <div className="text-center space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/forgot-password" className="text-amber-500 hover:text-amber-400 font-medium">
            Forgot your password?
          </Link>
        </p>
        <p className="text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-amber-500 hover:text-amber-400 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
