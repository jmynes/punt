import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../logger'

let debugSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('logging gates', () => {
  it('routes each level to the matching console method when enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG', 'true')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e', new Error('boom'))
    expect(debugSpy).toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('is silent in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_DEBUG', 'true')
    logger.info('nope')
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('is silent when NEXT_PUBLIC_DEBUG is explicitly false', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_DEBUG', 'false')
    logger.info('nope')
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('includes the error message in the formatted output', () => {
    vi.stubEnv('NEXT_PUBLIC_DEBUG', 'true')
    logger.error('failed', new Error('the cause'))
    expect(errorSpy.mock.calls[0][0]).toContain('the cause')
  })
})

describe('measure helpers', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_DEBUG', 'true'))

  it('measure returns the result and logs a performance line', () => {
    const result = logger.measure('work', () => 42)
    expect(result).toBe(42)
    expect(logSpy).toHaveBeenCalled()
  })

  it('measure rethrows and still logs', () => {
    expect(() =>
      logger.measure('boom', () => {
        throw new Error('x')
      }),
    ).toThrow('x')
    expect(logSpy).toHaveBeenCalled()
  })

  it('measureAsync returns the resolved value', async () => {
    const result = await logger.measureAsync('async', async () => 'ok')
    expect(result).toBe('ok')
  })

  it('measureAsync rethrows on rejection', async () => {
    await expect(
      logger.measureAsync('async-boom', async () => {
        throw new Error('y')
      }),
    ).rejects.toThrow('y')
  })
})
