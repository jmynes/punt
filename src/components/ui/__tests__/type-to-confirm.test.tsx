import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/__tests__/utils/test-utils'
import { TypeToConfirmInput } from '../type-to-confirm'

function TypeToConfirmWrapper(props: Partial<React.ComponentProps<typeof TypeToConfirmInput>>) {
  const [value, setValue] = useState('')
  return <TypeToConfirmInput requiredText="DELETE" value={value} onChange={setValue} {...props} />
}

describe('TypeToConfirmInput', () => {
  it('renders the required text prompt', () => {
    render(<TypeToConfirmWrapper />)
    expect(screen.getByText('DELETE')).toBeInTheDocument()
    expect(screen.getByText(/Type/)).toBeInTheDocument()
  })

  it('renders an input with placeholder', () => {
    render(<TypeToConfirmWrapper />)
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(<TypeToConfirmInput requiredText="DELETE" value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText('DELETE')
    await userEvent.setup().type(input, 'D')
    expect(onChange).toHaveBeenCalledWith('D')
  })

  it('can be disabled', () => {
    render(<TypeToConfirmWrapper disabled />)
    expect(screen.getByPlaceholderText('DELETE')).toBeDisabled()
  })

  it('applies custom text color', () => {
    render(<TypeToConfirmWrapper textColor="text-amber-400" />)
    const label = screen.getByText('DELETE')
    expect(label).toHaveClass('text-amber-400')
  })
})
