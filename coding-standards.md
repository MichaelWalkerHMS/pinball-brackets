# Coding Standards

Established code patterns and conventions for this project. All agents should follow these standards when writing code, and the code-review-agent should verify compliance.

---

## CSS & Styling

### Use CSS Variables for Colors

**Rule:** All color values in components must use CSS variables (`rgb(var(--color-*))`) rather than hardcoded hex values.

**Rationale:** Maintains theming consistency, enables future dark/light mode support, and keeps all colors centrally manageable.

**Violation:**
```tsx
<div className="bg-[#252323] text-[#f0b224]">
```

**Correct:**
```tsx
<div className="bg-[rgb(var(--color-unexpected-bg))] text-[rgb(var(--color-unexpected-text))]">
```

**Origin:** Found in PlayerSlot.tsx during review on 2026-01-10

---

## Project Structure

### Barrel Exports for Library Directories

**Rule:** All directories under `src/lib/` must have an `index.ts` file that re-exports public types and functions.

**Rationale:** Enables cleaner imports (`@/lib/matchplay` instead of `@/lib/matchplay/client`) and follows existing codebase patterns.

**Example:**
```typescript
// src/lib/matchplay/index.ts
export { MatchPlayClient, createMatchPlayClient } from './client';
export type {
  MatchPlayTournament,
  MatchPlayPlayer,
} from './types';
export { MatchPlayError } from './types';
```

**Origin:** Found in Match Play API Client review on 2026-01-11

---

### Don't Commit next-env.d.ts Changes

**Rule:** Never commit changes to `next-env.d.ts`. This is an auto-generated file that Next.js manages.

**Rationale:** The file header explicitly states it should not be edited. Changes cause unnecessary merge conflicts and aren't real code changes.

**Fix if changed:**
```bash
git checkout main -- next-env.d.ts
```

**Origin:** Found in multiple reviews (2026-01-10, 2026-01-11)

---

## Code Quality

### Remove Dead Code

**Rule:** Remove unused props, variables, imports, and functions. Don't leave them "for later."

**Rationale:** Dead code adds confusion and maintenance burden. If it's not used, delete it.

**Violation:**
```typescript
interface Props {
  name: string;
  position: number; // defined but never used
}

function Component({ name, position }: Props) {
  return <div>{name}</div>; // position never referenced
}
```

**Origin:** Found in PlayerSlot.tsx during review on 2026-01-10

---

## Database Migrations

### Clean Up Conflicting Migrations

**Rule:** Before merging, ensure there are no conflicting migration files (e.g., one that adds columns and another that removes them).

**Rationale:** Migration timestamps determine execution order. Conflicting migrations cause schema confusion and deployment issues.

**Origin:** Found in Bracket Result Display review on 2026-01-10

---

### Document Migrations

**Rule:** Include comments in migration files explaining:
1. What the migration does
2. Why it's needed
3. Reference to official documentation if applicable

**Example:**
```sql
-- Fix mutable search_path security warnings for Supabase functions
-- See: https://supabase.com/docs/guides/database/functions#security
-- Setting search_path to empty string prevents search path manipulation attacks
ALTER FUNCTION handle_updated_at() SET search_path = '';
```

**Origin:** Praised in security fix migration review on 2026-01-10

---

## API Clients

### Comprehensive Error Handling

**Rule:** API clients should:
1. Handle both JSON and non-JSON error responses gracefully
2. Use custom error classes with structured metadata (status code, error code)
3. Not expose internal implementation details in errors

**Example:**
```typescript
export class MatchPlayError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'MatchPlayError';
  }
}
```

**Origin:** Praised in Match Play API Client review on 2026-01-11

---

### Thorough API Client Test Coverage

**Rule:** API client tests should cover:
- Constructor behavior (explicit config, environment fallbacks, missing config errors)
- All public methods with successful responses
- Error scenarios (404, 401, 429, 500)
- Non-JSON error response handling

**Origin:** Praised in Match Play API Client review on 2026-01-11

---

## Utility Modules

### Well-Structured Utilities

**Rule:** Utility modules should have:
1. Clear type exports at the top
2. Reusable helper functions (not everything in one giant function)
3. Good separation between single-item and batch operations
4. Proper handling of edge cases

**Example structure:**
```typescript
// Types
export interface MatchResult { ... }
export type ActualParticipants = Map<string, ...>;

// Helpers
function buildResultMap(results: Result[]): Map<string, Result> { ... }
function getActualWinner(matchId: string, map: Map): number | null { ... }

// Main exports
export function getActualParticipant(matchId: string, results: Result[]): ... { ... }
export function getAllActualParticipants(results: Result[]): ActualParticipants { ... }
```

**Origin:** Praised in actualParticipants.ts review on 2026-01-10
