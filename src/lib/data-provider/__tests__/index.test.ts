import { beforeEach, describe, expect, it, vi } from 'vitest'

// Replace the concrete providers with lightweight fakes so we test only the
// factory's selection + singleton logic, not provider internals.
vi.mock('../api-provider', () => ({
  APIDataProvider: class {
    tabId: string
    constructor(tabId = '') {
      this.tabId = tabId
    }
  },
}))
vi.mock('../demo-provider', () => ({
  DemoDataProvider: class {
    kind = 'demo'
  },
}))
vi.mock('@/lib/demo/demo-config', () => ({ isDemoMode: vi.fn() }))

import { isDemoMode } from '@/lib/demo/demo-config'

const mockIsDemoMode = vi.mocked(isDemoMode)

async function loadFactory() {
  // Fresh module each test so the module-level singletons reset.
  vi.resetModules()
  return import('../index')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDataProvider', () => {
  it('returns a DemoDataProvider in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { getDataProvider } = await loadFactory()
    expect((getDataProvider() as { kind?: string }).kind).toBe('demo')
  })

  it('reuses the same demo provider instance (singleton)', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { getDataProvider } = await loadFactory()
    expect(getDataProvider()).toBe(getDataProvider())
  })

  it('returns an APIDataProvider in production mode', async () => {
    mockIsDemoMode.mockReturnValue(false)
    const { getDataProvider } = await loadFactory()
    expect((getDataProvider() as { tabId?: string }).tabId).toBe('')
  })

  it('reuses the API provider when the tabId is unchanged', async () => {
    mockIsDemoMode.mockReturnValue(false)
    const { getDataProvider } = await loadFactory()
    expect(getDataProvider('tab-1')).toBe(getDataProvider('tab-1'))
  })

  it('creates a new API provider when the tabId changes', async () => {
    mockIsDemoMode.mockReturnValue(false)
    const { getDataProvider } = await loadFactory()
    const first = getDataProvider('tab-1')
    const second = getDataProvider('tab-2')
    expect(first).not.toBe(second)
    expect((second as { tabId: string }).tabId).toBe('tab-2')
  })
})

describe('createDataProvider', () => {
  it('returns a fresh (non-singleton) instance each call', async () => {
    mockIsDemoMode.mockReturnValue(false)
    const { createDataProvider } = await loadFactory()
    expect(createDataProvider('t')).not.toBe(createDataProvider('t'))
  })

  it('returns a demo provider in demo mode', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { createDataProvider } = await loadFactory()
    expect((createDataProvider() as { kind?: string }).kind).toBe('demo')
  })
})

describe('useDataProvider', () => {
  it('delegates to getDataProvider', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const { useDataProvider, getDataProvider } = await loadFactory()
    expect(useDataProvider()).toBe(getDataProvider())
  })
})
