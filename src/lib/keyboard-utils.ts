/**
 * Returns true if the event target is an editable element (input, textarea,
 * select, or contentEditable). Useful for skipping custom keyboard shortcuts
 * when the user is interacting with form controls.
 */
export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}
