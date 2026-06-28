---
name: frontend-ui-engineering
description: Builds production-quality UIs. Use when building or modifying user-facing interfaces. Use when creating components, implementing layouts, managing state, or when the output needs to look and feel production-quality rather than AI-generated.
---

# Frontend UI Engineering

## Overview

Production-quality UI engineering: component architecture, accessible markup, responsive design, and state management. The bar is not "does it render?" — the bar is "would a user notice a difference from a product they paid for?"

## When to Use

- Building or modifying any user-facing component
- Implementing layouts, navigation, or data displays
- Adding or changing state management
- Any change that affects what a user sees or can interact with

## Component Architecture

### Hierarchy of Concerns

```
Page (route-level)
  └── Layout (grid/columns)
        ├── Feature Component (data + logic)
        │     └── UI Component (pure display, no data fetching)
        └── Shared Component (reusable, generic)
```

- **Page components** handle routing. No business logic.
- **Feature components** fetch data and own state. Not reusable.
- **UI components** receive props, render output. Fully reusable, no side effects.
- **Shared components** are the design system: Button, Input, Modal, etc.

### Component Rules

```tsx
// GOOD: UI component — pure, testable, reusable
interface SkillCardProps {
  name: string;
  description: string;
  onExport: () => void;
}

export function SkillCard({ name, description, onExport }: SkillCardProps) {
  return (
    <article className="skill-card">
      <h3>{name}</h3>
      <p>{description}</p>
      <button onClick={onExport} aria-label={`Export ${name} skill`}>
        Export
      </button>
    </article>
  );
}

// BAD: UI component that fetches its own data — not reusable, hard to test
export function SkillCard({ skillId }: { skillId: string }) {
  const { data } = useQuery(['skill', skillId], fetchSkill);
  // ...
}
```

## Accessibility (Non-Negotiable)

Every interactive element must be keyboard-accessible and screen-reader-friendly.

### Minimum Requirements (WCAG 2.1 AA)

```tsx
// Interactive elements use semantic HTML
<button onClick={handleExport}>Export Skill</button>  // ✓
<div onClick={handleExport}>Export Skill</div>        // ✗

// Images have alt text
<img src={logo} alt="GitScape logo" />
<img src={decoration} alt="" />  // decorative: explicit empty string

// Forms have associated labels
<label htmlFor="repo-url">Repository URL</label>
<input id="repo-url" type="url" required />

// Icon-only buttons have aria-label
<button aria-label="Close dialog">✕</button>

// Loading states are announced
<div aria-busy={isLoading} aria-label="Loading skills">
  {isLoading ? <Spinner /> : <SkillList />}
</div>
```

### Focus Management

- Tab order should follow visual order
- Modals trap focus while open; return focus on close
- Never remove focus outlines — style them instead

## State Management

### Where State Lives

| State Type | Where It Lives | Example |
|---|---|---|
| Server data | React Query / SWR | Fetched skill list |
| URL state | URL params | Active tab, filters |
| UI state (local) | `useState` in component | Modal open/closed |
| UI state (shared) | Lifted to nearest common ancestor | Selected file set |
| Global app state | Context or Zustand | Auth user, theme |

### Rules

- Never duplicate server state in local state — React Query is the cache
- Never put derived values in state — compute them during render
- Lift state only as high as necessary (not straight to global)

```tsx
// BAD: Derived value stored in state
const [filteredSkills, setFilteredSkills] = useState(skills);
useEffect(() => setFilteredSkills(skills.filter(...)), [skills, filter]);

// GOOD: Derived during render
const filteredSkills = skills.filter(...);
```

## Performance in Components

### Avoid Common Re-render Traps

```tsx
// BAD: Creates new object on every render, causing children to re-render
function SkillList() {
  return <SkillFilters options={{ sortBy: 'name', order: 'asc' }} />;
}

// GOOD: Stable reference
const DEFAULT_OPTIONS = { sortBy: 'name', order: 'asc' } as const;
function SkillList() {
  return <SkillFilters options={DEFAULT_OPTIONS} />;
}

// Use React.memo only for expensive components that receive stable props
const SkillCard = React.memo(function SkillCard({ skill }: Props) {
  return <div>{/* expensive render */}</div>;
});
```

### File Preview Truncation (GitScape-Specific)

File previews must be truncated to prevent browser freeze. Large files kill the page:

```tsx
const MAX_PREVIEW_CHARS = 10_000; // ~200 lines

function FilePreview({ content }: { content: string }) {
  const truncated = content.length > MAX_PREVIEW_CHARS;
  const display = truncated ? content.slice(0, MAX_PREVIEW_CHARS) : content;
  return (
    <div>
      <pre>{display}</pre>
      {truncated && (
        <p className="truncation-notice">
          Preview truncated — full content included in export.
        </p>
      )}
    </div>
  );
}
```

## Error States and Loading States

Every async operation needs all three states:

```tsx
function SkillExport() {
  const { data, isLoading, error } = useQuery(...);

  if (isLoading) return <LoadingSpinner label="Fetching repository files..." />;
  if (error) return <ErrorMessage message="Could not load repository. Check the URL and try again." />;
  return <SkillPreview data={data} />;
}
```

Never show a blank screen. Never swallow errors silently.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add accessibility later" | There is no later. Retrofitting keyboard nav into a complex component is 3x harder than building it in. |
| "The div with onClick works fine" | Until a keyboard user or screen reader user tries it. |
| "This state management is overkill for now" | Start right. Lifting state later causes cascading refactors. |
| "I'll handle the loading state after the happy path" | Users see loading states constantly. Handle them now. |

## Red Flags

- `<div onClick={...}>` anywhere
- Missing `alt` text on images
- Loading state shows blank content
- Error state shows a technical stack trace to the user
- State that could be derived from props/queries stored in `useState`
- `useEffect` used to sync local state with server data

## Verification

After any UI change:

- [ ] All interactive elements use semantic HTML (`button`, `a`, `input`)
- [ ] All images have `alt` text (or `alt=""` for decorative)
- [ ] All form inputs have associated labels
- [ ] Tab order is logical and focus is visible
- [ ] Loading, error, and empty states are handled
- [ ] Component renders correctly at 320px (mobile) and 1440px (desktop)
- [ ] No `console.error` or `console.warn` in the browser during normal use
