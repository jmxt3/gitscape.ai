# Spec: Remove Trio Feature Cards from Homepage

## Objective
Remove the three feature cards ("Code Digest", "Code Map", and "Agent Skill") from the homepage. This keeps the homepage clean and focused directly on the generator input and results.

## Commands / User Flows
- User visits the homepage.
- The three landing feature cards are no longer displayed.
- The input generator and all subsequent stages function identically to before.

## Project Structure
- `frontend/App.tsx`: Modify to remove import, state declarations (`stageComplete`, `hideCards`), and the render code of `FeatureCards`.
- `frontend/components/FeatureCards.tsx`: File will be deleted as it is no longer used anywhere.

## Code Style and Patterns
- Adhere to existing React / TypeScript patterns.
- Ensure that removing the states doesn't break other features (e.g., ensure `repoUrl` resetting and session checking still works fine without reference to the deleted states).

## Testing Strategy
- Since there are no frontend unit tests, verification will be performed via building the project (`npm run build` in the `frontend` directory) and manual execution.

## Boundaries
- **Always**: Keep the rest of the application completely functional.
- **Ask first**: If any other components depend on the removed state. (They do not).
- **Never**: Leave unused imports or dead state logic in `App.tsx` that might cause memory leaks or developer confusion.
