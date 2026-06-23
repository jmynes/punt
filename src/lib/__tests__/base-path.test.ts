import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, assetUrl, withBasePath } from '../base-path'

describe('base-path with no NEXT_PUBLIC_BASE_PATH', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
  })
  afterEach(() => vi.restoreAllMocks())

  it('withBasePath returns the path unchanged', () => {
    expect(withBasePath('/api/projects')).toBe('/api/projects')
  })

  it('assetUrl returns the path or undefined for nullish input', () => {
    expect(assetUrl('/uploads/a.webp')).toBe('/uploads/a.webp')
    expect(assetUrl(null)).toBeUndefined()
    expect(assetUrl(undefined)).toBeUndefined()
  })

  it('apiFetch fetches relative paths directly', async () => {
    await apiFetch('/api/projects')
    expect(fetch).toHaveBeenCalledWith('/api/projects', undefined)
  })

  it('apiFetch passes absolute URLs through unchanged', async () => {
    await apiFetch('https://example.com/api')
    expect(fetch).toHaveBeenCalledWith('https://example.com/api', undefined)
  })

  it('apiFetch passes non-string inputs through', async () => {
    const req = new Request('https://example.com/x')
    await apiFetch(req)
    expect(fetch).toHaveBeenCalledWith(req, undefined)
  })
})

describe('base-path with NEXT_PUBLIC_BASE_PATH set', () => {
  // basePath is read into a module-level const at import time, so we reset
  // modules and re-import after stubbing the env.
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/punt')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('prepends the basePath in withBasePath / assetUrl', async () => {
    const mod = await import('../base-path')
    expect(mod.withBasePath('/api/projects')).toBe('/punt/api/projects')
    expect(mod.assetUrl('/uploads/a.webp')).toBe('/punt/uploads/a.webp')
  })

  it('apiFetch prepends the basePath to relative paths', async () => {
    const mod = await import('../base-path')
    await mod.apiFetch('/api/projects')
    expect(fetch).toHaveBeenCalledWith('/punt/api/projects', undefined)
  })
})
