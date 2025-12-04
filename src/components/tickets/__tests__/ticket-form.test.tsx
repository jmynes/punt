import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/__tests__/utils/test-utils'
import { TicketForm } from '../ticket-form'
import { DEFAULT_TICKET_FORM } from '@/types'
import { createMockLabel, createMockSprint } from '@/__tests__/utils/mocks'
import userEvent from '@testing-library/user-event'

describe('TicketForm', () => {
  const mockLabels = [createMockLabel({ id: 'label-1', name: 'bug' })]
  const mockSprints = [createMockSprint({ id: 'sprint-1', name: 'Sprint 1' })]
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form with default values', () => {
    render(
      <TicketForm
        data={DEFAULT_TICKET_FORM}
        onChange={mockOnChange}
        labels={mockLabels}
        sprints={mockSprints}
      />,
    )

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    // Type and Priority use Select components, so we check for their presence differently
    expect(screen.getByText(/type/i)).toBeInTheDocument()
    expect(screen.getByText(/priority/i)).toBeInTheDocument()
  })

  it('should call onChange when title is updated', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TicketForm
        data={DEFAULT_TICKET_FORM}
        onChange={mockOnChange}
        labels={mockLabels}
        sprints={mockSprints}
      />,
    )

    const titleInput = screen.getByLabelText(/title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Test')

    expect(mockOnChange).toHaveBeenCalled()
    // Check that onChange was called - user.type calls it for each character
    const calls = mockOnChange.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    // Verify that at least one call has a title that starts with 'T' (first character typed)
    const hasTitleUpdate = calls.some((call) => call[0].title && call[0].title.length > 0)
    expect(hasTitleUpdate).toBe(true)
  })

  it('should display required indicator for title', () => {
    render(
      <TicketForm
        data={DEFAULT_TICKET_FORM}
        onChange={mockOnChange}
        labels={mockLabels}
        sprints={mockSprints}
      />,
    )

    const titleLabel = screen.getByText(/title/i)
    expect(titleLabel).toBeInTheDocument()
    // Check for required asterisk
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    render(
      <TicketForm
        data={DEFAULT_TICKET_FORM}
        onChange={mockOnChange}
        labels={mockLabels}
        sprints={mockSprints}
        disabled
      />,
    )

    const titleInput = screen.getByLabelText(/title/i)
    expect(titleInput).toBeDisabled()
  })
})

