'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface TestDrawerProps {
  open: boolean
  onClose: () => void
}

export function TestDrawer({ open, onClose }: TestDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-zinc-800 bg-zinc-950 p-0 sm:max-w-xl md:max-w-2xl"
        style={{
          // Force hardware acceleration for smooth animation
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b border-zinc-800 px-6 pr-14 py-4">
            <SheetTitle className="text-base font-mono text-zinc-400">
              Test Drawer
            </SheetTitle>
            <SheetDescription className="sr-only">
              Empty test drawer for animation testing
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 p-6 opacity-0 translate-y-2 transition-all duration-300 ease-out delay-200 data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100 opacity-0 translate-y-1 transition-all duration-200 ease-out delay-300 data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
                Animation Test Drawer
              </h2>
              <p className="text-zinc-400 opacity-0 translate-y-1 transition-all duration-200 ease-out delay-400 data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
                This is an empty, stateless drawer for testing animation performance.
                It contains minimal content and no state management.
              </p>
              <div className="rounded-lg border border-zinc-700 p-4 opacity-0 translate-y-2 transition-all duration-200 ease-out delay-500 data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                  Performance Notes
                </h3>
                <ul className="text-sm text-zinc-400 space-y-1">
                  <li>• Hardware accelerated animations</li>
                  <li>• Optimized CSS transitions</li>
                  <li>• Minimal re-renders</li>
                  <li>• No complex state management</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 p-6 opacity-0 translate-y-1 transition-all duration-200 ease-out delay-600 data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
            <Button onClick={onClose} className="w-full">
              Close Test Drawer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
