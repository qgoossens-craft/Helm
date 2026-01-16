# UI Patterns - Gotchas

## Clickable headers with icons
- When a `<button>` wrapping icons has click issues, use a `<div>` with `role="button"` instead
- Add `cursor-pointer`, `select-none`, `tabIndex={0}`, and keyboard handling for accessibility
- Lucide icons inside buttons can have inconsistent click behavior across browsers
