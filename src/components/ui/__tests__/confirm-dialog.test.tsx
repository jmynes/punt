import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'
import { ConfirmDialog, useConfirmation } from '../confirm-dialog'

describe('ConfirmDialog', () => {
  it('renders title, description, and buttons when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete item?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    )
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        confirmLabel="Yes"
        onConfirm={onConfirm}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm on Enter key (form submit)', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        confirmLabel="Yes"
        onConfirm={onConfirm}
      />,
    )
    // Focus the confirm button and press Enter
    const btn = screen.getByRole('button', { name: 'Yes' })
    btn.focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows loading state when onConfirm returns a promise', async () => {
    let resolvePromise: () => void
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve
        }),
    )

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))

    // Should show spinner while loading
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled()
    })

    // Resolve the promise
    // biome-ignore lint/style/noNonNullAssertion: test variable assigned in callback
    resolvePromise!()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled()
    })
  })

  it('disables confirm button when disabled prop is true', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        disabled
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('uses custom cancel label', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        cancelLabel="Nope"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Nope' })).toBeInTheDocument()
  })

  it('renders children between description and footer', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        onConfirm={() => {}}
      >
        <p>Extra content here</p>
      </ConfirmDialog>,
    )
    expect(screen.getByText('Extra content here')).toBeInTheDocument()
  })

  it('applies destructive styling', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        description="Sure?"
        confirmLabel="Delete"
        actionVariant="destructive"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600')
  })
})

describe('useConfirmation', () => {
  function TestComponent() {
    const { confirm, ConfirmationDialog } = useConfirmation()
    const [result, setResult] = useState<boolean | null>(null)

    return (
      <div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: 'Are you sure?',
              description: 'This is permanent.',
              confirmLabel: 'Yes',
              actionVariant: 'destructive',
            })
            setResult(ok)
          }}
        >
          Open
        </button>
        {result !== null && <span data-testid="result">{result ? 'confirmed' : 'cancelled'}</span>}
        {ConfirmationDialog}
      </div>
    )
  }

  it('resolves true when confirmed', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('confirmed')
    })
  })

  it('resolves false when cancelled', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('cancelled')
    })
  })
})
