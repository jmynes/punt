import { describe, expect, it, vi } from 'vitest'
import { ConsoleProvider } from '../providers/console-provider'
import { NoopProvider } from '../providers/noop-provider'
import type { EmailMessage } from '../types'

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }))

const message: EmailMessage = {
  to: 'a@b.com',
  subject: 'Hi',
  html: '<p>hello</p>',
  text: 'hello',
}

describe('ConsoleProvider', () => {
  it('is always configured and reports success', async () => {
    const provider = new ConsoleProvider()
    expect(provider.name).toBe('console')
    expect(provider.isConfigured()).toBe(true)
    expect(await provider.send(message)).toBe(true)
  })

  it('handles an array of recipients and a reply-to', async () => {
    const provider = new ConsoleProvider()
    const result = await provider.send({
      ...message,
      to: ['a@b.com', 'c@d.com'],
      replyTo: 'reply@b.com',
    })
    expect(result).toBe(true)
  })
})

describe('NoopProvider', () => {
  it('reports not-configured and silently discards', async () => {
    const provider = new NoopProvider()
    expect(provider.name).toBe('noop')
    expect(provider.isConfigured()).toBe(false)
    expect(await provider.send(message)).toBe(false)
  })
})
