interface InlineCodeTextProps {
  text: string
  className?: string
}

/**
 * Renders text with backtick-wrapped segments styled as inline code.
 * Example: "Fix bug in `calculateTotal` function" renders with monospace styling for `calculateTotal`.
 */
export function InlineCodeText({ text, className }: InlineCodeTextProps) {
  // Parse text to find backtick-wrapped segments
  const parts = parseInlineCode(text)

  if (parts.length === 1 && !parts[0].isCode) {
    // No code segments, return plain text
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.isCode ? (
          <code
            key={index}
            className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[0.9em] text-amber-300"
          >
            {part.text}
          </code>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  )
}

interface ParsedPart {
  text: string
  isCode: boolean
}

/**
 * Parses text to identify backtick-wrapped code segments.
 * Returns an array of parts, each marked as code or plain text.
 */
export function parseInlineCode(text: string): ParsedPart[] {
  const parts: ParsedPart[] = []
  let currentIndex = 0
  let inCode = false
  let segmentStart = 0

  while (currentIndex < text.length) {
    if (text[currentIndex] === '`') {
      // Found a backtick
      if (currentIndex > segmentStart) {
        // Add the text before this backtick
        parts.push({
          text: text.slice(segmentStart, currentIndex),
          isCode: inCode,
        })
      }
      inCode = !inCode
      segmentStart = currentIndex + 1
    }
    currentIndex++
  }

  // Add remaining text
  if (segmentStart < text.length) {
    parts.push({
      text: text.slice(segmentStart),
      isCode: inCode, // If still inCode, the backtick was never closed - treat as code anyway
    })
  }

  // Handle edge case: if we end in code mode with no text after, we have an unclosed backtick
  // In this case, the last segment should be treated as plain text with the backtick
  if (inCode && parts.length > 0) {
    const lastPart = parts[parts.length - 1]
    if (lastPart.isCode) {
      lastPart.isCode = false
      lastPart.text = `\`${lastPart.text}`
    }
  }

  // If no parts were created, return the original text
  if (parts.length === 0) {
    return [{ text, isCode: false }]
  }

  return parts
}
