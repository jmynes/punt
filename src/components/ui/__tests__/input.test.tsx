import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/__tests__/utils/test-utils'
import { Input } from '../input'
import userEvent from '@testing-library/user-event'

describe('Input', () => {
  it('should render input element', () => {
    render(<Input data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
  })

  it('should handle value changes', async () => {
    const user = userEvent.setup()
    render(<Input data-testid="test-input" />)
    const input = screen.getByTestId('test-input') as HTMLInputElement

    await user.type(input, 'test value')
    expect(input.value).toBe('test value')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Input disabled data-testid="test-input" />)
    expect(screen.getByTestId('test-input')).toBeDisabled()
  })

  it('should apply placeholder', () => {
    render(<Input placeholder="Enter text" data-testid="test-input" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('should handle onChange events', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()
    render(<Input onChange={handleChange} data-testid="test-input" />)

    await user.type(screen.getByTestId('test-input'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })
})

