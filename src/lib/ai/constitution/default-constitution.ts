// =============================================================================
// AI Team Studio — Default Project Constitution
// =============================================================================
// A governance document that ALL AI agents must respect. Defines architectural
// rules, coding standards, and constraints that agents cannot violate.
//
// When no project-specific constitution exists, this default template is
// injected into agent context to ensure baseline quality standards.
// =============================================================================

/**
 * Default Project Constitution template.
 * Used when a project does not yet have a custom CONSTITUTION document.
 */
export const DEFAULT_CONSTITUTION = `# Project Constitution

## Coding Standards
- Use TypeScript with strict mode
- All functions must have JSDoc comments
- No any types — use proper typing
- Use async/await, never raw promises

## Architecture Rules
- Follow the repository pattern for data access
- Components must be functional (no class components)
- State management via React hooks or context
- API routes follow REST conventions

## Quality Gates
- All features must have unit tests
- No console.log in production code
- Error boundaries on all page components
- Accessibility: all interactive elements must be keyboard navigable

## Technology Constraints
- Frontend: React/Next.js only
- Styling: Tailwind CSS only (no inline styles)
- Database: Use Prisma ORM (no raw SQL)
- Authentication: NextAuth.js

## Off-Limits
- Do not modify authentication flow without explicit approval
- Do not add new npm dependencies without justification
- Do not change database schema without migration
`;
