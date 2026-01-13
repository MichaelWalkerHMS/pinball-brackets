# Match Play API Integration Plan

## Overview

Integrate Match Play Events API to enable:
- Tournament creation from Match Play data
- Automatic player/seed import and refresh
- Results synchronization during tournaments

**Architecture Approach:** Use API routes (not just server actions) to support future cron automation.

---

## Environment Setup

Add to `.env.local`, `.env.test`, and Vercel:
```
MATCHPLAY_API_TOKEN=<your-token>
```

---

## File Structure

```
src/lib/matchplay/
  client.ts           # Core API client
  types.ts            # Match Play API response types
  roundMapper.ts      # Round/position mapping to internal format
  playerMapper.ts     # Player data transformation
  resultMapper.ts     # Result data transformation

src/app/api/matchplay/
  tournament/route.ts   # Fetch tournament details
  players/route.ts      # Fetch players for import
  results/route.ts      # Fetch results for single tournament
  bulk-results/route.ts # Fetch results for all MP tournaments
```

---

## Round Mapping Strategy

Match Play rounds map differently based on tournament size:

### 24-Player Tournament
| Match Play | Internal | Description |
|------------|----------|-------------|
| Round 0    | 0        | Opening (seeds 9-24) |
| Round 1    | 1        | Round of 16 |
| Round 2    | 2        | Quarterfinals |
| Round 3    | 3        | Semifinals |
| Round 4    | 4        | Finals |
| Special    | 5        | Consolation (3rd place) |

### 16-Player Tournament
| Match Play | Internal | Description |
|------------|----------|-------------|
| Round 0    | 1        | Round of 16 (no opening) |
| Round 1    | 2        | Quarterfinals |
| Round 2    | 3        | Semifinals |
| Round 3    | 4        | Finals |
| Special    | 5        | Consolation (3rd place) |

**Key Difference:** 16-player tournaments skip internal round 0 (no opening round). Match Play's first round maps to R16 (internal 1).

```typescript
function mapRound(mpRound: number, playerCount: 16 | 24): number {
  if (playerCount === 16) {
    return mpRound + 1; // Offset by 1 (no opening round)
  }
  return mpRound; // 24-player: direct mapping
}
```

**Match Position Mapping:** Map by seed pairings from `constants.ts`, not by index. For example, if Match Play reports a game with seeds 9 vs 24, find the internal position where those seeds play (Opening position 0). Use `ROUND_OF_16_MATCHES_16P` for 16-player tournaments.

---

## Parallel Development Strategy

**Git Worktree Branches:**
1. `feature/mp-api-client` - Foundation (must merge first)
2. `feature/mp-player-sync` - Player import/refresh features
3. `feature/mp-results-sync` - Results import features

**Merge Order:**
1. Merge `mp-api-client` to main
2. Then `mp-player-sync` and `mp-results-sync` can be built in parallel
3. Merge in any order after Feature 1 is complete

---

## Feature Tracking

### MP-001: Match Play API Client
**Status:** Incomplete
**Branch:** `feature/mp-api-client`
**Priority:** 1 (Foundation - must complete first)

**Files to create:**
- `src/lib/matchplay/client.ts`
- `src/lib/matchplay/types.ts`

**Implementation:**
- [ ] Create `MatchPlayClient` class with Bearer token auth
- [ ] Implement `getTournament(id)` method
- [ ] Implement `getTournamentWithPlayers(id)` method
- [ ] Implement `getGames(tournamentId, status?)` method
- [ ] Implement error handling with typed `MatchPlayError`
- [ ] Add unit tests with mocked responses

**Key Code:**
```typescript
export class MatchPlayClient {
  private baseUrl = 'https://app.matchplay.events/api';

  async getTournamentWithPlayers(id: string) {
    return this.fetch(`/tournaments/${id}?includePlayers=true`);
  }

  async getGames(tournamentId: string, status?: 'completed') {
    const params = status ? `?status=${status}` : '';
    return this.fetch(`/tournaments/${tournamentId}/games${params}`);
  }
}
```

---

### MP-002: Tournament Shell Import
**Status:** Incomplete
**Branch:** `feature/mp-api-client`
**Priority:** 2
**Depends on:** MP-001

**Files to modify:**
- `src/app/admin/tournament/new/page.tsx`
- `src/components/admin/TournamentForm.tsx`

**Files to create:**
- `src/app/api/matchplay/tournament/route.ts`

**Implementation:**
- [ ] Add "Fetch from Match Play" button next to matchplay_id input
- [ ] Create API route to fetch tournament data
- [ ] Map Match Play fields to form fields (name, dates)
- [ ] Pre-fill form for admin review
- [ ] Handle errors gracefully (invalid ID, API down)

---

### MP-003: Player/Seed Import
**Status:** Incomplete
**Branch:** `feature/mp-player-sync`
**Priority:** 3
**Depends on:** MP-001

**Files to modify:**
- `src/app/admin/tournament/[id]/PlayerManagement.tsx`

**Files to create:**
- `src/app/api/matchplay/players/route.ts`
- `src/lib/matchplay/playerMapper.ts`

**Implementation:**
- [ ] Add "Import from Match Play" button (visible if matchplay_id exists)
- [ ] Create API route to fetch players with seeds
- [ ] Map Match Play player data to internal format
- [ ] Use existing `bulkImportPlayers` action for persistence
- [ ] Store Match Play player IDs in `players.matchplay_id`

---

### MP-004: Player/Seed Refresh with Diff Detection
**Status:** Incomplete
**Branch:** `feature/mp-player-sync`
**Priority:** 4
**Depends on:** MP-003

**Files to modify:**
- `src/app/admin/tournament/[id]/PlayerManagement.tsx`

**Files to create:**
- `src/app/admin/tournament/[id]/MatchPlayDiff.tsx`

**Implementation:**
- [ ] Detect when players already exist
- [ ] Fetch current players from DB + Match Play
- [ ] Compare and generate diff (added, removed, reseeded)
- [ ] Show diff modal only if changes exist
- [ ] Check for existing brackets and warn if changes would impact them
- [ ] Require confirmation before applying changes

---

### MP-005: Manual Results Pull
**Status:** Incomplete
**Branch:** `feature/mp-results-sync`
**Priority:** 3
**Depends on:** MP-001

**Files to modify:**
- `src/app/admin/tournament/[id]/ResultsEntry.tsx`

**Files to create:**
- `src/app/api/matchplay/results/route.ts`
- `src/lib/matchplay/roundMapper.ts`
- `src/lib/matchplay/resultMapper.ts`

**Implementation:**
- [ ] Add "Sync from Match Play" button in Results tab header
- [ ] Create API route to fetch completed games
- [ ] Create round mapper (Match Play rounds → internal 0-5)
- [ ] Create position mapper (seed pairings → match positions)
- [ ] Use existing `saveResult` action for each result
- [ ] Display count of imported results
- [ ] Handle partial results (tournament in progress)

**Round Mapper Logic:**
```typescript
// Map by finding which match has these seeds
function findMatchPosition(
  round: number,
  seed1: number,
  seed2: number,
  playerCount: 24 | 16
): number {
  // Use OPENING_ROUND_MATCHES, ROUND_OF_16_MATCHES from constants
  // Find the match where these seeds play
}
```

---

### MP-006: Bulk Results Pull
**Status:** Incomplete
**Branch:** `feature/mp-results-sync`
**Priority:** 5
**Depends on:** MP-005

**Files to modify:**
- `src/app/admin/page.tsx`

**Files to create:**
- `src/app/api/matchplay/bulk-results/route.ts`

**Implementation:**
- [ ] Add "Sync All Match Play Results" button on admin dashboard
- [ ] Query all tournaments where `matchplay_id IS NOT NULL`
- [ ] For each, call the results sync logic from MP-005
- [ ] Show progress indicator during sync
- [ ] Display summary (X results imported across Y tournaments)

---

### MP-007: Automation Architecture Prep
**Status:** Incomplete
**Branch:** (any branch)
**Priority:** 6
**Depends on:** MP-005, MP-006

**Implementation:**
- [ ] Ensure all API routes can be called with service role auth (for cron)
- [ ] Document Vercel cron configuration for future use
- [ ] Consider adding `last_mp_sync` timestamp to tournaments table (optional)

**Future Vercel Cron Config (not implemented now):**
```json
{
  "crons": [{
    "path": "/api/matchplay/bulk-results",
    "schedule": "0 * * * *"
  }]
}
```

---

## Critical Files Reference

| Purpose | Path |
|---------|------|
| Round/match constants | `src/lib/bracket/constants.ts` |
| Type definitions | `src/lib/types/index.ts` |
| Player mutations | `src/app/admin/tournament/[id]/actions.ts` |
| Score recalculation | `src/lib/scoring/recalculateScores.ts` |
| Admin tournament page | `src/app/admin/tournament/[id]/page.tsx` |
| Tournament form | `src/components/admin/TournamentForm.tsx` |

---

## Testing Requirements

**Unit Tests:**
- Round mapper functions
- Player mapper functions
- Result mapper functions
- API client with mocked responses

**E2E Tests:**
- Player import flow (mock Match Play API)
- Results sync flow (mock Match Play API)

---

## Verification Checklist

After implementation:
- [ ] Can fetch tournament data from Match Play and pre-fill form
- [ ] Can import players with seeds from Match Play
- [ ] Refreshing players shows diff and warns only when changes exist
- [ ] Can pull results from Match Play and see them in Results tab
- [ ] Bracket scores recalculate after results import
- [ ] Bulk results pull updates all Match Play tournaments
- [ ] All Match Play operations require admin authentication
