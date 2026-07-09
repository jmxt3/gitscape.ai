# Spec: Move and Restructure DevTools Tabs to Hero Section

## Objective
Move the Terminal (CLI) and Your Agent (MCP) tabs from the bottom "DevTools" section into the main Hero section's primary interaction card, creating a single unified tab-based workspace.
- The first tab will be **Web** (which renders the main repository generator field).
- The second and third tabs will be **Terminal** (CLI) and **Your agent** (MCP) respectively.
- Remove the bottom `DevTools` section.
- Display the "Every skill scanned by ScapeGuard" badge in the tab bar row, aligned to the right.

## Commands / User Flows
- User lands on GitScape.
- In the main card, the user sees three tabs: **Web**, **Terminal**, and **Your agent** (with **Web** selected by default).
- When **Web** is selected:
  - The repository URL input field (`RepoInput`) and its generation/progress UI are shown.
- When **Terminal** is selected:
  - The CLI installation code snippets and usage details are displayed in their original layout inside the card.
- When **Your agent** is selected:
  - The MCP configuration and instruction snippets are displayed in their original layout inside the card.
- The "Every skill scanned by ScapeGuard" badge is visible at the top-right of the card's header row, linking to `#security`.

## Project Structure
- [frontend/App.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/App.tsx):
  - Add state for the active tab: `activeMainTab`.
  - Add rendering logic for the tabs, the ScapeGuard badge, and the conditional display of the panels.
  - Remove `<DevTools />` component and import.
- [frontend/components/Hero.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/components/Hero.tsx):
  - Remove the ScapeGuard badge from the Hero text area as it is now inside the main card.
- [frontend/components/DevToolsSection.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/components/DevToolsSection.tsx):
  - Export `CliPanel` and `McpPanel` so they can be rendered directly by `App.tsx`.

## Code Style and Patterns
- Use React `useState` for local tab switching state.
- Keep responsive Tailwind layouts to ensure clean rendering on mobile and desktop.
- Retain the exact same styles, colors, and margins of the panels to preserve visual identity.

## Testing Strategy
- Compile the frontend (`npm run build`) to verify TypeScript and build correctness.
- Verify visually in the browser using the browser subagent.

## Boundaries
- **Always**: Ensure that generating a skill from the Web tab still fully functions, showing the progress bar and output area correctly.
- **Ask first**: N/A
- **Never**: Break existing responsive styling or leave dead code/unused imports.
