# Accessibility Checklist

Quick reference for WCAG 2.1 AA compliance in GitScape's React frontend. Use alongside the `frontend-ui-engineering` skill.

## Minimum Requirements (Every PR)

### Interactive Elements
- [ ] All buttons use `<button>`, all navigation uses `<a href>`
- [ ] No `<div onClick>` or `<span onClick>` patterns
- [ ] Icon-only buttons have `aria-label="Description"`
- [ ] Tab order follows visual order; focus is visible

### Images
- [ ] All meaningful images have descriptive `alt="..."` text
- [ ] Decorative images have `alt=""` (explicit empty)

### Forms
- [ ] Every `<input>` has an associated `<label>` (via `htmlFor`/`id` or wrapping)
- [ ] Required fields indicated with text, not color alone
- [ ] Error messages are specific and associated with the field

### Dynamic Content
- [ ] Loading states announced: `aria-busy={isLoading}`
- [ ] Status messages use `role="status"` or `aria-live="polite"`
- [ ] Error messages use `role="alert"` for immediate announcement
- [ ] Modals trap focus while open; return focus on close

## Quick Fixes Reference

| Issue | Fix |
|-------|-----|
| `<div onClick>` | Replace with `<button>` |
| Missing `alt` | Add `alt="description"` or `alt=""` for decorative |
| Color-only error state | Add border, icon, or text indicator |
| Missing label | Add `<label htmlFor="id">` or `aria-label` |
| Focus not visible | Style `:focus-visible` ring, never `outline: none` |

## Testing Tools

```bash
# Automated audit (run in CI)
npx axe-core

# Chrome DevTools
# → Lighthouse → Accessibility category
# → Elements → Accessibility tree

# Manual: Tab through every interactive element
# Verify: focus is visible and order is logical
```

## GitScape-Specific Checks

- [ ] File selector checkboxes have labels (filename is the label)
- [ ] "Export" buttons describe what they export: `aria-label="Export skill as ZIP"`
- [ ] Skill preview area is keyboard-scrollable
- [ ] Error messages from failed GitHub fetches are announced to screen readers
