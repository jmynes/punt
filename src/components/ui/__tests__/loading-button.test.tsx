import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/__tests__/utils/test-utils'
import { LoadingButton } from '../button'

describe('LoadingButton', () => {
  it('renders children when not loading', () => {
    render(<LoadingButton>Save</LoadingButton>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows spinner when loading', () => {
    const { container } = render(<LoadingButton loading>Save</LoadingButton>)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows loadingText when loading and loadingText is provided', () => {
    render(
      <LoadingButton loading loadingText="Saving...">
        Save
      </LoadingButton>,
    )
    expect(screen.getByRole('button', { name: /Saving/ })).toBeInTheDocument()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('keeps children visible when loading without loadingText', () => {
    render(<LoadingButton loading>Save</LoadingButton>)
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('is disabled when loading', () => {
    render(<LoadingButton loading>Save</LoadingButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<LoadingButton disabled>Save</LoadingButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('passes through variant and size props', () => {
    const { container } = render(
      <LoadingButton variant="primary" size="sm">
        Save
      </LoadingButton>,
    )
    expect(container.firstChild).toHaveClass('bg-amber-600')
    expect(container.firstChild).toHaveClass('h-8')
  })

  it('handles click events when not loading', async () => {
    const onClick = vi.fn()
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire click when loading', async () => {
    const onClick = vi.fn()
    render(
      <LoadingButton loading onClick={onClick}>
        Save
      </LoadingButton>,
    )
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
