# Admin Player Management: Add & Edit Players

## Overview

Add UI for single-player create and inline rename in the admin tournament player management page. The server actions already exist - this feature only requires UI changes.

**Scope:** Admin-only functionality
**Files:** Primarily `src/app/admin/tournament/[id]/PlayerManagement.tsx`

---

## Requirements

### Add Player
- "Add Player" button at bottom of player list
- Simple form: player name input only
- New player always appends at end (gets next available seed)
- Validation: name required, tournament not at max capacity
- Shows loading state during save
- Clears form and refreshes list on success

### Edit Player Name (Inline)
- Click on player name to edit in-place
- Input field replaces text, Enter to save, Escape to cancel
- Validation: name required
- Shows loading state during save
- Reverts to original name on cancel or error

---

## Existing Server Actions (DO NOT MODIFY)

Location: `src/app/admin/tournament/[id]/actions.ts`

### `addPlayer(tournamentId, name, seed)` (lines 274-353)
- Adds single player at specified seed position
- For this feature: pass `seed = players.length + 1` (append at end)
- Shifts existing players down if needed (not needed when appending)
- Logs to seeding_change_log
- Returns `{ success: true, player }` or `{ success: false, error }`

### `updatePlayerName(playerId, name)` (lines 153-196)
- Updates player's name
- Logs rename to seeding_change_log
- Returns `{ success: true }` or `{ success: false, error }`

---

## Implementation Steps

### Step 1: Add inline edit state to PlayerManagement.tsx

Add state for tracking which player is being edited:
```typescript
const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
const [editingName, setEditingName] = useState('')
const [isUpdating, setIsUpdating] = useState(false)
```

### Step 2: Add inline edit handlers

```typescript
const handleStartEdit = (player: Player) => {
  setEditingPlayerId(player.id)
  setEditingName(player.name)
}

const handleCancelEdit = () => {
  setEditingPlayerId(null)
  setEditingName('')
}

const handleSaveEdit = async () => {
  if (!editingPlayerId || !editingName.trim()) return
  setIsUpdating(true)
  const result = await updatePlayerName(editingPlayerId, editingName.trim())
  setIsUpdating(false)
  if (result.success) {
    handleCancelEdit()
    router.refresh()
  } else {
    // Show error (toast or inline)
  }
}
```

### Step 3: Modify SortablePlayerRow to support inline edit

Current player name display becomes conditional:
- If `editingPlayerId === player.id`: show input field
- Otherwise: show clickable name span

```tsx
{editingPlayerId === player.id ? (
  <input
    value={editingName}
    onChange={(e) => setEditingName(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') handleSaveEdit()
      if (e.key === 'Escape') handleCancelEdit()
    }}
    autoFocus
    disabled={isUpdating}
    className="..."
  />
) : (
  <span
    onClick={() => handleStartEdit(player)}
    className="cursor-pointer hover:text-blue-600"
  >
    {player.name}
  </span>
)}
```

### Step 4: Add "Add Player" section at bottom

After the player list, add:
```tsx
<div className="mt-4 border-t pt-4">
  <h4 className="font-medium mb-2">Add Player</h4>
  <form onSubmit={handleAddPlayer} className="flex gap-2">
    <input
      type="text"
      value={newPlayerName}
      onChange={(e) => setNewPlayerName(e.target.value)}
      placeholder="Player name"
      className="flex-1 px-3 py-2 border rounded"
      disabled={isAdding || players.length >= tournament.max_players}
    />
    <button
      type="submit"
      disabled={isAdding || !newPlayerName.trim() || players.length >= tournament.max_players}
      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
    >
      {isAdding ? 'Adding...' : 'Add'}
    </button>
  </form>
  {players.length >= tournament.max_players && (
    <p className="text-sm text-gray-500 mt-1">Tournament is at maximum capacity</p>
  )}
</div>
```

### Step 5: Add state and handler for adding player

```typescript
const [newPlayerName, setNewPlayerName] = useState('')
const [isAdding, setIsAdding] = useState(false)

const handleAddPlayer = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!newPlayerName.trim()) return

  setIsAdding(true)
  const nextSeed = players.length + 1
  const result = await addPlayer(tournament.id, newPlayerName.trim(), nextSeed)
  setIsAdding(false)

  if (result.success) {
    setNewPlayerName('')
    router.refresh()
  } else {
    // Show error
  }
}
```

---

## Testing Checklist

### Manual Testing
- [ ] Add player with valid name - player appears at end of list
- [ ] Add player when at max capacity - button disabled, message shown
- [ ] Add player with empty name - button disabled
- [ ] Click player name - inline edit activates
- [ ] Edit and press Enter - name updates
- [ ] Edit and press Escape - reverts to original
- [ ] Edit with empty name - should not save (validation)
- [ ] Verify seeding_change_log entries created for add/rename

### E2E Test (create new: `e2e/admin-players.spec.ts`)
- Test add player flow
- Test inline rename flow
- Verify player appears in correct position
- Verify error handling

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/admin/tournament/[id]/PlayerManagement.tsx` | Add inline edit + add player UI |

## Files to Read (Context)
| File | Why |
|------|-----|
| `src/app/admin/tournament/[id]/actions.ts` | Understand existing addPlayer/updatePlayerName actions |
| `src/lib/types/index.ts` | Player type definition |

---

## Notes

- The server actions handle all seeding change logging automatically
- Do not modify the server actions - they are already complete
- Keep UI simple and consistent with existing admin patterns
- Use existing button/input styles from the component
