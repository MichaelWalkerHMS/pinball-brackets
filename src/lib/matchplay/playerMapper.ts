import type { MatchPlayPlayer } from "./types";

/**
 * Mapped player data for import into our database
 */
export interface MappedPlayer {
  name: string;
  seed: number;
  matchplay_id: string;
  ifpa_id: number | null;
}

/**
 * Map Match Play player data to our internal format
 *
 * @param players - Array of Match Play player objects
 * @returns Array of mapped player objects sorted by seed
 */
export function mapMatchPlayPlayers(players: MatchPlayPlayer[]): MappedPlayer[] {
  // Filter to only active players with seeds
  const activePlayers = players.filter(
    (p) => p.status === "active" && p.seed !== null
  );

  // Map to our format and sort by seed
  return activePlayers
    .map((p) => ({
      name: p.name,
      seed: p.seed as number,
      matchplay_id: String(p.playerId),
      ifpa_id: p.ifpaId,
    }))
    .sort((a, b) => a.seed - b.seed);
}

/**
 * Player diff types for MP-004 refresh feature
 */
export interface PlayerDiff {
  added: MappedPlayer[];
  removed: { name: string; seed: number }[];
  reseeded: { name: string; oldSeed: number; newSeed: number }[];
  renamed: { matchplayId: string; oldName: string; newName: string; seed: number }[];
}

/**
 * Compare current database players with Match Play players to generate a diff
 *
 * @param currentPlayers - Players currently in the database (with matchplay_id)
 * @param mpPlayers - Players from Match Play API
 * @returns Diff object describing changes
 */
export function comparePlayerLists(
  currentPlayers: Array<{ name: string; seed: number; matchplay_id: string | null }>,
  mpPlayers: MappedPlayer[]
): PlayerDiff {
  const diff: PlayerDiff = {
    added: [],
    removed: [],
    reseeded: [],
    renamed: [],
  };

  // Create maps for easy lookup
  const currentByMpId = new Map<string, { name: string; seed: number }>();
  const currentBySeed = new Map<number, { name: string; matchplay_id: string | null }>();

  for (const p of currentPlayers) {
    if (p.matchplay_id) {
      currentByMpId.set(p.matchplay_id, { name: p.name, seed: p.seed });
    }
    currentBySeed.set(p.seed, { name: p.name, matchplay_id: p.matchplay_id });
  }

  const mpById = new Map<string, MappedPlayer>();
  for (const p of mpPlayers) {
    mpById.set(p.matchplay_id, p);
  }

  // Check for added and changed players from Match Play
  for (const mpPlayer of mpPlayers) {
    const currentPlayer = currentByMpId.get(mpPlayer.matchplay_id);

    if (!currentPlayer) {
      // Player exists in Match Play but not in our DB
      diff.added.push(mpPlayer);
    } else {
      // Player exists in both - check for changes
      if (currentPlayer.seed !== mpPlayer.seed) {
        diff.reseeded.push({
          name: mpPlayer.name,
          oldSeed: currentPlayer.seed,
          newSeed: mpPlayer.seed,
        });
      }
      if (currentPlayer.name !== mpPlayer.name) {
        diff.renamed.push({
          matchplayId: mpPlayer.matchplay_id,
          oldName: currentPlayer.name,
          newName: mpPlayer.name,
          seed: mpPlayer.seed,
        });
      }
    }
  }

  // Check for removed players (in our DB but not in Match Play)
  for (const current of currentPlayers) {
    if (current.matchplay_id && !mpById.has(current.matchplay_id)) {
      diff.removed.push({ name: current.name, seed: current.seed });
    }
  }

  return diff;
}

/**
 * Check if a diff has any changes
 */
export function hasDiffChanges(diff: PlayerDiff): boolean {
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.reseeded.length > 0 ||
    diff.renamed.length > 0
  );
}
