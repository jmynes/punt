import Link from 'next/link'
import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Create an account</h1>
        <p className="text-zinc-500">Get started with Punt</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse bg-zinc-800/50 rounded-lg" />}>
        <RegisterForm />
      </Suspense>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
