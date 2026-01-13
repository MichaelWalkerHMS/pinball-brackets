# MatchPlay Linked Indicator

## Overview
Add a visual indicator on the bracket edit page showing whether the tournament is linked to MatchPlay. The indicator should appear near the Save button and include a tooltip explaining the benefit of MatchPlay integration.

## Requirements
- Display a green "lit" indicator with text "MatchPlay Linked" when `tournament.matchplay_id` is set
- Display a red/gray "unlit" indicator with text "MatchPlay Not Linked" when `matchplay_id` is null
- On hover, show a tooltip:
  - Linked: "This tournament is on Match Play, so results will be synced automatically!"
  - Not Linked: "This tournament is not linked to Match Play. Results must be entered manually."
- Position: Near the Save button in the bracket toolbar area

## Technical Implementation

### Files to Modify
1. **`src/components/bracket/Bracket.tsx`** - Add the indicator component near the Save button (around line 375)

### Files to Create
1. **`src/components/bracket/MatchPlayIndicator.tsx`** - New component for the indicator

### Component Design

```tsx
// src/components/bracket/MatchPlayIndicator.tsx
interface MatchPlayIndicatorProps {
  isLinked: boolean;
}

export default function MatchPlayIndicator({ isLinked }: MatchPlayIndicatorProps) {
  // Renders:
  // - A small circle (green filled when linked, gray/red outline when not)
  // - Text label ("MatchPlay Linked" or "MatchPlay Not Linked")
  // - Tooltip on hover with explanation
}
```

### Styling Guidelines
Use existing CSS custom properties for consistency:
- Linked (green): `--color-success-icon`, `--color-success-bg`, `--color-success-text`
- Not linked (red/gray): `--color-error-icon` or `--color-text-muted`

### Tooltip Implementation
Use CSS-only tooltip (`:hover` + `::after` pseudo-element) or a simple `title` attribute. CSS approach preferred for better styling control:
```tsx
<div className="relative group">
  {/* indicator content */}
  <div className="absolute hidden group-hover:block ...tooltip-styles">
    {tooltipText}
  </div>
</div>
```

### Integration Point in Bracket.tsx
Around line 375, before or after the Save button:
```tsx
{/* MatchPlay indicator */}
<MatchPlayIndicator isLinked={!!tournament.matchplay_id} />

{/* Save button */}
<button ...>
```

## Data Flow
- `tournament` is already passed to `BracketView` as a prop
- `Tournament` type already includes `matchplay_id: string | null` (defined in `src/lib/types/index.ts`)
- No database changes required
- No API changes required

## Testing Verification
1. Navigate to a bracket for a tournament WITH a MatchPlay ID - should show green "MatchPlay Linked"
2. Navigate to a bracket for a tournament WITHOUT a MatchPlay ID - should show red/gray "MatchPlay Not Linked"
3. Hover over the indicator - tooltip should appear with appropriate message
4. Verify indicator is visible on both desktop and mobile layouts
5. Run `npm run build` to ensure no TypeScript errors

## Reference Files
- `src/components/bracket/Bracket.tsx` - Main bracket component (line ~375 for Save button location)
- `src/lib/types/index.ts` - Tournament type definition with matchplay_id field
- `src/components/dashboard/BracketStatusBadge.tsx` - Example of existing status indicator pattern
