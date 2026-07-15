# Spec: Dedicated Public Skill Registry Page

## Objective
Move the Public Agent Skill Registry from a tab on the main landing page to a dedicated, unique page. Provide a "Registry" link in the header navbar to access it, and ensure all navigation works cleanly in a Single Page App (SPA) setup without page reloads.

## Commands / User Flows
- User visits the home page (`/`). The main input container displays tabs for "Web", "CLI", and "MCP" (the "Registry" tab is removed).
- User clicks the "Registry" link in the header navbar.
- The URL path changes to `/registry` without reloading the page.
- The application displays the dedicated Public Skill Registry page. The Hero section and main generator input are hidden; only the Header navbar, the RegistryView container (with its search/index interface), and the Footer are displayed.
- User clicks "How it works", "CLI & MCP", "Security", or "Open source" in the navbar.
- The application navigates back to the home page (`/`) and smooth-scrolls to the corresponding section.
- User reloads the page while on `/registry`. The application correctly initializes and mounts the Registry view.

## Project Structure
- [frontend/App.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/App.tsx): Implement custom client-side routing to manage the current path, remove the "registry" tab, wrap the home page sections to conditionally render only on the home route, and pass routing handlers to the Header.
- [frontend/components/Header.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/components/Header.tsx): Add the "Registry" link, adjust standard anchor links to support routing back to home sections, and call the navigation callback.

## Code Style and Patterns
- Use React 19 state and DOM history API (`window.history.pushState`, `popstate` event) for lightweight, dependency-free routing.
- Keep style tokens, tailwind classes, and CSS structures consistent with the existing GitScape UI theme (dark mode, glassmorphism, cyan/violet/emerald color accents).

## Testing Strategy
- Manual verification of URL routing, back/forward button behavior, page reloading on `/registry`, and scrolling on landing sections.
- Verification that all console warnings or errors are absent.

## Boundaries
- **Always**: Keep the RegistryView fully functional and visually aligned with the design language.
- **Never**: Break direct URL sharing (e.g. going directly to `/registry`).
- **Never**: Introduce page reloads for internal navigation.
