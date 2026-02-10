'use client'

import Link from 'next/link'
import { getTicketReferencePath, parseTicketReferences } from '@/lib/ticket-references'

interface LinkedTextProps {
  text: string
  className?: string
}

/**
 * Renders text with ticket key references (e.g., PUNT-123) as clickable links.
 * Non-ticket text is rendered as plain text.
 *
 * Links navigate to the canonical ticket URL which will open the ticket drawer.
 */
export function LinkedText({ text, className }: LinkedTextProps) {
  const parts = parseTicketReferences(text)

  // No ticket references found, return plain text
  if (parts.length === 1 && !parts[0].ticketKey) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.ticketKey ? (
          <Link
            key={index}
            href={getTicketReferencePath(part.ticketKey)}
            className="font-mono text-amber-500 hover:text-amber-400 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            {part.text}
          </Link>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  )
}
