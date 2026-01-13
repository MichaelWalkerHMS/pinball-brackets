# Private Bracket Indicator on Leaderboard

## Overview

Show "(private)" indicator next to the current user's private brackets on the leaderboard. This helps users understand why others can't see their bracket.

**Scope:** Single component change
**File:** `src/components/leaderboard/LeaderboardRow.tsx`

---

## Requirements

- Show "(private)" text only for the current user's own private brackets
- Do NOT show indicator for other users' brackets (they can't see private ones anyway due to RLS)
- Subtle styling (gray, smaller text)
- Appears after the bracket name

---

## Existing Infrastructure

### Data Available
- `entry.is_public` - boolean indicating bracket visibility
- `isCurrentUser` - already calculated in LeaderboardRow (line 31)

### RLS Behavior
- Users can only see: public brackets + their own (public or private)
- So if a bracket is private and visible, it MUST be the current user's

---

## Implementation

### Single Change in LeaderboardRow.tsx

Location: After the bracket name display (around line 55-65)

```tsx
// Current: just shows bracket name
<span className="font-medium text-gray-900">{bracketDisplay.primary}</span>

// Updated: add private indicator for current user's private brackets
<span className="font-medium text-gray-900">
  {bracketDisplay.primary}
  {isCurrentUser && !entry.is_public && (
    <span className="ml-2 text-xs font-normal text-gray-500">(private)</span>
  )}
</span>
```

### Full Context (lines ~50-70)

```tsx
<div className="min-w-0 flex-1">
  <div className="flex items-center gap-2">
    <span className="font-medium text-gray-900">
      {bracketDisplay.primary}
      {isCurrentUser && !entry.is_public && (
        <span className="ml-2 text-xs font-normal text-gray-500">(private)</span>
      )}
    </span>
    {isCurrentUser && (
      <span className="text-yellow-500" title="Your bracket">
        <StarIcon className="h-4 w-4" />
      </span>
    )}
  </div>
  {bracketDisplay.secondary && (
    <p className="text-sm text-gray-500">{bracketDisplay.secondary}</p>
  )}
</div>
```

---

## Testing Checklist

### Manual Testing
- [ ] Private bracket owned by current user - shows "(private)"
- [ ] Public bracket owned by current user - no indicator
- [ ] Public bracket owned by other user - no indicator
- [ ] Styling is subtle and doesn't disrupt layout
- [ ] Indicator appears after bracket name, before star icon

### E2E Test (update existing `e2e/leaderboard.spec.ts`)
- Create private bracket
- Navigate to leaderboard
- Verify "(private)" indicator is visible
- Toggle to public, verify indicator disappears

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/leaderboard/LeaderboardRow.tsx` | Add conditional "(private)" text |

## Files to Read (Context)
| File | Why |
|------|-----|
| `src/lib/types/index.ts` | LeaderboardEntry type with is_public field |

---

## Notes

- This is a minimal change - just conditional rendering
- The logic `isCurrentUser && !entry.is_public` ensures indicator only shows for owner's private brackets
- No backend changes needed - data already available
- Consider: could use an icon (lock) instead of text, but "(private)" is clearer
