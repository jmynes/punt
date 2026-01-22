'use client'

import { BookOpen, Github } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>© 2026 PUNT</span>
        <div className="flex items-center gap-4">
          <a
            href="https://jmynes.github.io/punt/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </a>
          <a
            href="https://github.com/jmynes/punt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
