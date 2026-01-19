import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-center overflow-auto bg-zinc-950 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
