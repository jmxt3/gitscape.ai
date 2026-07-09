# Spec: Adjust Footer Links and License

## Objective
Update the landing page footer of GitScape to accurately reflect the license type (Apache 2.0 instead of MIT) and remove the obsolete/deprecated "API docs" link.

## Commands / User Flows
- A user scrolls to the bottom of the GitScape landing page.
- In the footer, they see:
  - "made with ❤️ by João Machete" on the left.
  - Links on the right: "GitHub", "CLI on npm", "MCP server", and "Apache 2.0 license".
  - The "API docs" link is removed.
- Clicking the "Apache 2.0 license" link opens the official project license at `https://github.com/jmxt3/Git-Scape-Web/blob/main/LICENSE` in a new tab.

## Project Structure
- [frontend/App.tsx](file:///c:/Users/jmach/dev/GitScape/frontend/App.tsx):
  - Remove the "API docs" anchor element.
  - Modify the label of the license anchor element from "MIT license" to "Apache 2.0 license".

## Code Style and Patterns
- Maintain the same visual structure, classes, spacing, and styling of the footer.
- Use clean, standard JSX/React structure.

## Testing Strategy
- Run frontend build to ensure there are no compilation or TypeScript errors.
- Use the browser subagent to verify the footer layout visually and verify that the links are updated as expected.

## Boundaries
- **Always**: Keep the existing font sizes, spacing, colors, and layout structure of the footer intact.
- **Never**: Add the "API docs" link back or reference the license as "MIT license".
