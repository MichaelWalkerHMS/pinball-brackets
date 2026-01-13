# Bracket Naming Feature

## Overview

Allow users to name and rename their brackets via an editable field in the bracket controls. The database field and save action already support this - only UI changes needed.

**Scope:** User-facing bracket editor
**Primary File:** `src/components/bracket/Bracket.tsx`

---

## Requirements

- Editable bracket name field in the bracket controls section
- Users can set/change name at any time (during creation or editing)
- Name is optional - empty name falls back to "Username's Bracket" on leaderboard
- Name persists with bracket save
- Reasonable max length (50 chars suggested)

---

## Existing Infrastructure (Already Works)

### Database
- `brackets.name` field exists (nullable text)
- Schema: `supabase/migrations/` already includes name field

### Save Action (`src/app/tournament/[id]/actions.ts`)
- `saveBracket()` already accepts `bracketName` in `SaveBracketInput`
- Properly saves to database
- **Current problem:** Line 339 in Bracket.tsx hardcodes `bracketName: ""`

### Display Logic (Already Works)
- `LeaderboardRow.tsx` (lines 10-24): Shows custom name if set, otherwise "Owner's Bracket"
- `bracket/[id]/page.tsx` (lines 98-116): Shared view displays bracket name correctly

---

## Implementation Steps

### Step 1: Add bracketName state to Bracket.tsx

Around line 60-80 where other state is defined:
```typescript
const [bracketName, setBracketName] = useState<string>(initialBracket?.name || '')
```

Note: Need to pass `initialBracket.name` from the edit page component.

### Step 2: Add name input field to bracket controls

Location: Around lines 296-350 in Bracket.tsx (where save button is)

Add before or after the visibility toggle:
```tsx
<div className="flex flex-col gap-1">
  <label htmlFor="bracket-name" className="text-sm font-medium text-gray-700">
    Bracket Name (optional)
  </label>
  <input
    id="bracket-name"
    type="text"
    value={bracketName}
    onChange={(e) => setBracketName(e.target.value)}
    placeholder="My Bracket"
    maxLength={50}
    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  />
  <p className="text-xs text-gray-500">
    Leave empty to use your display name
  </p>
</div>
```

### Step 3: Update save action call

Currently line ~339:
```typescript
// BEFORE (hardcoded empty string)
bracketName: "",

// AFTER (use state value)
bracketName: bracketName.trim(),
```

### Step 4: Pass initial bracket name from edit page

In `src/app/tournament/[id]/edit/page.tsx`, ensure the bracket name is passed to the Bracket component:

Check if `existingBracket?.name` is already passed. If not, add it to props.

---

## Edge Cases

1. **Empty name** - Valid, fallback display handles this
2. **Whitespace-only name** - Trim before saving, treat as empty
3. **Very long name** - Limit with `maxLength={50}` on input
4. **Special characters** - Allow any characters (names can have apostrophes, etc.)

---

## Testing Checklist

### Manual Testing
- [ ] Create new bracket with name - verify name appears on leaderboard
- [ ] Create new bracket without name - verify fallback display works
- [ ] Edit existing bracket - name field shows current name
- [ ] Change bracket name and save - verify update persists
- [ ] Clear bracket name and save - verify fallback display resumes
- [ ] Name with 50 characters - verify truncation at input level
- [ ] Name with special characters (apostrophes, etc.) - verify saves correctly

### E2E Test (update existing `e2e/bracket.spec.ts`)
- Add test case for naming bracket during creation
- Add test case for renaming existing bracket
- Verify name appears on leaderboard after save

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/bracket/Bracket.tsx` | Add name input, update save call |
| `src/app/tournament/[id]/edit/page.tsx` | Pass bracket name to component (if not already) |

## Files to Read (Context)
| File | Why |
|------|-----|
| `src/app/tournament/[id]/actions.ts` | Understand saveBracket input shape |
| `src/lib/types/index.ts` | Bracket type with name field |
| `src/components/leaderboard/LeaderboardRow.tsx` | See how names are displayed |

---

## Notes

- This is primarily a UI addition - backend already supports names
- The fix is essentially: add input field, wire state, pass to save action
- Keep styling consistent with existing form elements in the component
- The name field should feel optional, not required
