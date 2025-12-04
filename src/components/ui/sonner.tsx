'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-400" />,
        info: <InfoIcon className="size-4 text-blue-400" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-400" />,
        error: <OctagonXIcon className="size-4 text-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin text-zinc-400" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'text-white shadow-xl !border-2 !border-solid',
          title: 'text-white font-medium',
          description: 'text-zinc-300',
          actionButton: 'bg-amber-500 hover:bg-amber-600 text-black font-medium',
          cancelButton: 'bg-zinc-700 hover:bg-zinc-600 text-white',
          success: '!bg-zinc-950 !border-emerald-500',
          error: '!bg-zinc-950 !border-red-500',
          warning: '!bg-zinc-950 !border-amber-500',
          info: '!bg-zinc-950 !border-blue-500',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
