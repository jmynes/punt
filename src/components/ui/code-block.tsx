'use client'

import { Check, Copy } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language?: 'json' | 'bash' | 'text'
  filename?: string
  className?: string
  onCopy?: () => void
}

/**
 * Syntax highlighting for JSON with specific token colors
 */
function highlightJson(code: string): React.ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, lineIndex) => {
    const tokens: React.ReactNode[] = []
    let remaining = line
    let keyIndex = 0

    while (remaining.length > 0) {
      // Match string keys (before colon)
      const keyMatch = remaining.match(/^(\s*)"([^"]+)"(\s*:)/)
      if (keyMatch) {
        tokens.push(
          <span key={`${lineIndex}-ws-${keyIndex}`}>{keyMatch[1]}</span>,
          <span key={`${lineIndex}-q1-${keyIndex}`} className="text-zinc-500">
            "
          </span>,
          <span key={`${lineIndex}-key-${keyIndex}`} className="text-cyan-400">
            {keyMatch[2]}
          </span>,
          <span key={`${lineIndex}-q2-${keyIndex}`} className="text-zinc-500">
            "
          </span>,
          <span key={`${lineIndex}-colon-${keyIndex}`} className="text-zinc-400">
            {keyMatch[3]}
          </span>,
        )
        remaining = remaining.slice(keyMatch[0].length)
        keyIndex++
        continue
      }

      // Match string values
      const stringMatch = remaining.match(/^"([^"]*)"/)
      if (stringMatch) {
        tokens.push(
          <span key={`${lineIndex}-sq1-${keyIndex}`} className="text-zinc-500">
            "
          </span>,
          <span key={`${lineIndex}-str-${keyIndex}`} className="text-amber-400">
            {stringMatch[1]}
          </span>,
          <span key={`${lineIndex}-sq2-${keyIndex}`} className="text-zinc-500">
            "
          </span>,
        )
        remaining = remaining.slice(stringMatch[0].length)
        keyIndex++
        continue
      }

      // Match brackets and braces
      const bracketMatch = remaining.match(/^([{}[\]])/)
      if (bracketMatch) {
        tokens.push(
          <span key={`${lineIndex}-br-${keyIndex}`} className="text-zinc-400">
            {bracketMatch[1]}
          </span>,
        )
        remaining = remaining.slice(1)
        keyIndex++
        continue
      }

      // Match punctuation (comma)
      const punctMatch = remaining.match(/^,/)
      if (punctMatch) {
        tokens.push(
          <span key={`${lineIndex}-punc-${keyIndex}`} className="text-zinc-500">
            ,
          </span>,
        )
        remaining = remaining.slice(1)
        keyIndex++
        continue
      }

      // Match whitespace
      const wsMatch = remaining.match(/^\s+/)
      if (wsMatch) {
        tokens.push(<span key={`${lineIndex}-space-${keyIndex}`}>{wsMatch[0]}</span>)
        remaining = remaining.slice(wsMatch[0].length)
        keyIndex++
        continue
      }

      // Match anything else
      tokens.push(
        <span key={`${lineIndex}-other-${keyIndex}`} className="text-zinc-300">
          {remaining[0]}
        </span>,
      )
      remaining = remaining.slice(1)
      keyIndex++
    }

    return (
      <span key={lineIndex}>
        {tokens}
        {lineIndex < lines.length - 1 && '\n'}
      </span>
    )
  })
}

/**
 * Syntax highlighting for bash commands
 */
function highlightBash(code: string): React.ReactNode[] {
  const lines = code.split('\n')
  return lines.map((line, lineIndex) => {
    const tokens: React.ReactNode[] = []
    let remaining = line
    let keyIndex = 0

    while (remaining.length > 0) {
      // Match comments
      const commentMatch = remaining.match(/^(#.*)$/)
      if (commentMatch) {
        tokens.push(
          <span key={`${lineIndex}-comment-${keyIndex}`} className="text-zinc-500 italic">
            {commentMatch[1]}
          </span>,
        )
        remaining = ''
        continue
      }

      // Match flags
      const flagMatch = remaining.match(/^(--?[\w-]+)/)
      if (flagMatch) {
        tokens.push(
          <span key={`${lineIndex}-flag-${keyIndex}`} className="text-cyan-400">
            {flagMatch[1]}
          </span>,
        )
        remaining = remaining.slice(flagMatch[0].length)
        keyIndex++
        continue
      }

      // Match strings
      const stringMatch = remaining.match(/^("[^"]*"|'[^']*')/)
      if (stringMatch) {
        tokens.push(
          <span key={`${lineIndex}-str-${keyIndex}`} className="text-amber-400">
            {stringMatch[1]}
          </span>,
        )
        remaining = remaining.slice(stringMatch[0].length)
        keyIndex++
        continue
      }

      // Match anything else
      tokens.push(
        <span key={`${lineIndex}-other-${keyIndex}`} className="text-zinc-300">
          {remaining[0]}
        </span>,
      )
      remaining = remaining.slice(1)
      keyIndex++
    }

    return (
      <span key={lineIndex}>
        {tokens}
        {lineIndex < lines.length - 1 && '\n'}
      </span>
    )
  })
}

export function CodeBlock({
  code,
  language = 'text',
  filename,
  className,
  onCopy,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      onCopy?.()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }, [code, onCopy])

  const highlightedCode =
    language === 'json' ? highlightJson(code) : language === 'bash' ? highlightBash(code) : code

  return (
    <div className={cn('group relative', className)}>
      {filename && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 border-b border-zinc-700/50 rounded-t-lg">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            {filename}
          </span>
        </div>
      )}
      <div
        className={cn(
          'relative bg-zinc-900 border border-zinc-700/50',
          filename ? 'rounded-b-lg' : 'rounded-lg',
        )}
      >
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-md transition-all',
            'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800',
            copied && 'text-emerald-400 hover:text-emerald-400',
          )}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed font-mono">
          <code>{highlightedCode}</code>
        </pre>
      </div>
    </div>
  )
}
