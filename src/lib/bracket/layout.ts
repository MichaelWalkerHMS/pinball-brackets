import { ROUNDS } from "./constants";

// Base layout units for bracket display
// Match height = 2 PlayerSlots (56px each) + 1px divider + 2px border + result bar (24px)
//   + Matchup Analysis button (24px + 4px top margin)
// PlayerSlots are h-14 (56px) to always accommodate "Expected X" message
// Result bar and analysis button are always rendered (invisible when empty) for consistent height
export const MATCH_HEIGHT = 167;
export const MATCH_GAP = 8; // Small gap between adjacent matches
export const BASE_UNIT = MATCH_HEIGHT + MATCH_GAP; // fundamental spacing unit

// Round header height (title + match count + margins + padding + border)
// Calculated from: text-sm title (20px) + text-xs count (16px) + pb-2 (8px) + border (1px) + mb-2 (8px)
export const HEADER_HEIGHT = 53;

// Gap between matches for each round
// Formula: GAP_N = MATCH_HEIGHT + 2 * GAP_{N-1}
// This ensures each match is vertically centered between its two feeder matches
const QUARTERS_GAP = MATCH_HEIGHT + 2 * MATCH_GAP;
const SEMIS_GAP = MATCH_HEIGHT + 2 * QUARTERS_GAP;

export const ROUND_GAP: Record<number, number> = {
  [ROUNDS.OPENING]: MATCH_GAP,
  [ROUNDS.ROUND_OF_16]: MATCH_GAP,
  [ROUNDS.QUARTERS]: QUARTERS_GAP, // centered between R16 pairs
  [ROUNDS.SEMIS]: SEMIS_GAP, // centered between QF pairs
  [ROUNDS.FINALS]: MATCH_GAP, // single match
  [ROUNDS.CONSOLATION]: MATCH_GAP, // single match
};

// Top padding for each round to center matches with their source matches from the previous round
// Formula: PADDING_N = PADDING_{N-1} + (MATCH_HEIGHT + GAP_{N-1}) / 2
const QUARTERS_PADDING = Math.round(BASE_UNIT / 2);
const SEMIS_PADDING = QUARTERS_PADDING + (MATCH_HEIGHT + QUARTERS_GAP) / 2;
const FINALS_PADDING = SEMIS_PADDING + (MATCH_HEIGHT + SEMIS_GAP) / 2;

export const ROUND_PADDING: Record<number, number> = {
  [ROUNDS.OPENING]: 0,
  [ROUNDS.ROUND_OF_16]: 0,
  [ROUNDS.QUARTERS]: QUARTERS_PADDING, // center between R16 pairs
  [ROUNDS.SEMIS]: SEMIS_PADDING, // center between QF pairs
  [ROUNDS.FINALS]: FINALS_PADDING, // center between SF pairs
  [ROUNDS.CONSOLATION]: 0,
};

/**
 * Calculate the Y center position of a match given its index and round.
 * Used by BracketConnector to draw lines between matches.
 */
export function getMatchCenterY(round: number, matchIndex: number): number {
  // Anchor lines at the player card's midpoint (2 x 56px slots + 1px divider + 2px border),
  // not the full box: the result bar and analysis button below it would pull lines onto the bottom player.
  // Every match shares this offset, so destination matches stay centered between their feeders.
  const matchCenter = (2 * 56 + 1 + 2) / 2;
  const padding = ROUND_PADDING[round] ?? 0;
  const gap = ROUND_GAP[round] ?? MATCH_GAP;

  // Match n center = padding + n * (matchHeight + gap) + matchCenter
  return padding + matchIndex * (MATCH_HEIGHT + gap) + matchCenter;
}
