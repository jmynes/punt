'use client'

import { useState } from 'react'
import { DescriptionEditor } from '@/components/tickets/description-editor'

export default function EditorTestPage() {
  const [markdown, setMarkdown] = useState(`# Welcome to MDXEditor Test

This is a **test page** for the MDXEditor component.

## Features

- *Italic* text
- **Bold** text
- \`inline code\`
- [Links](https://example.com)

### Code Block

\`\`\`javascript
function hello() {
  console.log('Hello, world!')
}
\`\`\`

> This is a blockquote

- List item 1
- List item 2
- List item 3
`)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">MDXEditor Test Page</h1>
      <p className="text-zinc-400 mb-6">
        This is an isolated test page for the MDXEditor component. Use this to debug dropdown issues
        without the complexity of modals or drawers.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Description Editor</label>
          <DescriptionEditor markdown={markdown} onChange={setMarkdown} />
        </div>

        <div className="mt-8 space-y-2">
          <label className="text-sm font-medium text-zinc-300">Markdown Output</label>
          <pre className="bg-zinc-900 border border-zinc-700 rounded-md p-4 text-xs text-zinc-300 overflow-auto">
            {markdown}
          </pre>
        </div>
      </div>
    </div>
  )
}


