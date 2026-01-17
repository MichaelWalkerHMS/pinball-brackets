import { ROUNDS } from "./constants";

// Base layout units for bracket display
// Match height = 2 PlayerSlots (56px each) + 1px divider + 2px border + result bar (24px)
// PlayerSlots are h-14 (56px) to always accommodate "Expected X" message
// Result bar is always rendered (invisible when empty) for consistent height
export const MATCH_HEIGHT = 139;
export const MATCH_GAP = 8; // Small gap between adjacent matches
export const BASE_UNIT = MATCH_HEIGHT + MATCH_GAP; // 147px - fundamental spacing unit

// Round header height (title + match count + margins + padding + border)
// Calculated from: text-sm title (20px) + text-xs count (16px) + pb-2 (8px) + border (1px) + mb-2 (8px)
export const HEADER_HEIGHT = 53;

// Top padding for each round to center matches with their source matches from the previous round
// Formula: padding = (center of first pair from previous round) - (MATCH_HEIGHT / 2)
export const ROUND_PADDING: Record<number, number> = {
  [ROUNDS.OPENING]: 0,
  [ROUNDS.ROUND_OF_16]: 0,
  [ROUNDS.QUARTERS]: Math.round(BASE_UNIT / 2), // 74px - center between R16 pairs
  [ROUNDS.SEMIS]: 221, // center between QF pairs
  [ROUNDS.FINALS]: 515, // center between SF pairs
  [ROUNDS.CONSOLATION]: 0,
};

// Gap between matches for each round
// Formula: GAP_N = MATCH_HEIGHT + 2 * GAP_{N-1}
// This ensures each match is vertically centered between its two feeder matches
export const ROUND_GAP: Record<number, number> = {
  [ROUNDS.OPENING]: MATCH_GAP, // 8px
  [ROUNDS.ROUND_OF_16]: MATCH_GAP, // 8px
  [ROUNDS.QUARTERS]: MATCH_HEIGHT + 2 * MATCH_GAP, // 155px - centered between R16 pairs
  [ROUNDS.SEMIS]: MATCH_HEIGHT + 2 * (MATCH_HEIGHT + 2 * MATCH_GAP), // 449px - centered between QF pairs
  [ROUNDS.FINALS]: MATCH_GAP, // 8px (single match)
  [ROUNDS.CONSOLATION]: MATCH_GAP, // 8px (single match)
};

/**
 * Calculate the Y center position of a match given its index and round.
 * Used by BracketConnector to draw lines between matches.
 */
export function getMatchCenterY(round: number, matchIndex: number): number {
  const matchCenter = MATCH_HEIGHT / 2; // 36px from top of match
  const padding = ROUND_PADDING[round] ?? 0;
  const gap = ROUND_GAP[round] ?? MATCH_GAP;

  // Match n center = padding + n * (matchHeight + gap) + matchCenter
  return padding + matchIndex * (MATCH_HEIGHT + gap) + matchCenter;
}
