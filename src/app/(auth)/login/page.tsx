import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Welcome to Punt</h1>
        <p className="text-zinc-500">Sign in to your account</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
