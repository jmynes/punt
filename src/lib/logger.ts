type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'performance'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
  error?: Error
  duration?: number
  label?: string
}

class Logger {
  private isEnabled(): boolean {
    // Disable in production builds
    if (process.env.NODE_ENV === 'production') {
      return false
    }

    // Check for explicit debug flag
    if (process.env.NEXT_PUBLIC_DEBUG === 'false') {
      return false
    }

    // Enable in development or if explicitly enabled
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_DEBUG === 'true'
    )
  }

  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, data, error, duration, label } = entry

    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

    if (label && duration !== undefined) {
      logMessage += ` (${label}: ${duration}ms)`
    }

    if (error) {
      logMessage += `\nError: ${error.message}`
      if (error.stack) {
        logMessage += `\nStack: ${error.stack}`
      }
    }

    if (data) {
      logMessage += `\nData: ${JSON.stringify(data, null, 2)}`
    }

    return logMessage
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    if (!this.isEnabled()) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
      error,
    }

    const formatted = this.formatLog(entry)

    switch (level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
      case 'performance':
        console.log(formatted)
        break
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.log('error', message, data, error)
  }

  performance(label: string, duration: number, data?: unknown): void {
    if (!this.isEnabled()) {
      return
    }

    const entry: LogEntry = {
      level: 'performance',
      message: `Performance: ${label}`,
      timestamp: new Date().toISOString(),
      label,
      duration,
      data,
    }

    const formatted = this.formatLog(entry)
    console.log(formatted)
  }

  // Helper to measure performance
  measure<T>(label: string, fn: () => T, data?: unknown): T {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      this.performance(label, duration, data)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.performance(label, duration, { ...data, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  // Helper to measure async performance
  async measureAsync<T>(
    label: string,
    fn: () => Promise<T>,
    data?: unknown,
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.performance(label, duration, data)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.performance(label, duration, { ...data, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }
}

// Export singleton instance
export const logger = new Logger()

