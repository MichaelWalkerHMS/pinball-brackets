// Database row types (matching Supabase schema)

export interface Tournament {
  id: string;
  name: string;
  state: string;
  year: number;
  lock_date: string;
  start_date: string;
  end_date: string;
  player_count: number;
  status: 'upcoming' | 'in_progress' | 'completed';
  is_active: boolean;
  timezone: string;
  scoring_config: ScoringConfig;
  matchplay_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoringConfig {
  opening: number;
  round_of_16: number;
  quarters: number;
  semis: number;
  finals: number;
}

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  seed: number;
  ifpa_id: number | null;
  matchplay_id: string | null;
  created_at: string;
}

export interface Bracket {
  id: string;
  user_id: string;
  tournament_id: string;
  name: string | null;
  is_public: boolean;
  final_winner_games: number | null;
  final_loser_games: number | null;
  // Cached scoring fields (updated when results change)
  score: number;
  correct_champion: boolean | null;
  game_score_diff: number | null;
  total_correct: number;
  created_at: string;
  updated_at: string;
}

export interface Pick {
  id: string;
  bracket_id: string;
  round: number;
  match_position: number;
  winner_seed: number;
  is_correct: boolean | null; // Cached: whether pick matches result (null = no result yet)
  created_at: string;
}

export interface Result {
  id: string;
  tournament_id: string;
  round: number;
  match_position: number;
  winner_seed: number;
  loser_seed: number;
  winner_games: number;
  loser_games: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// UI State types for bracket component

export interface BracketState {
  tournamentId: string;
  bracketId: string | null;
  isPublic: boolean;
  bracketName: string;
  picks: Map<string, number>; // key: "round-position", value: winner_seed
  finalWinnerGames: number | null;
  finalLoserGames: number | null;
  isDirty: boolean;
}

// Player lookup map: seed -> Player
export type PlayerMap = Map<number, Player>;

// For server action payloads
export interface SaveBracketInput {
  tournamentId: string;
  bracketId: string | null; // If provided, updates existing bracket; if null, creates new
  isPublic: boolean;
  bracketName: string;
  picks: Array<{ round: number; matchPosition: number; winnerSeed: number }>;
  finalWinnerGames: number | null;
  finalLoserGames: number | null;
}

export interface LoadBracketResult {
  bracket: Bracket | null;
  picks: Pick[];
}

// Leaderboard entry - bracket with owner info for display
export interface LeaderboardEntry {
  id: string;
  name: string | null;
  owner_id: string;
  owner_display_name: string;
  is_public: boolean;
  score: number | null;
  correct_champion: boolean | null;
  game_score_diff: number | null;
  total_correct: number | null;
  created_at: string;
}

// Admin types

export interface TournamentFormData {
  name: string;
  state: string;
  year: number;
  lock_date: string;
  start_date: string;
  end_date: string;
  player_count: 16 | 24;
  timezone: string;
  matchplay_id?: string;
}

export interface ResultInput {
  round: number;
  match_position: number;
  winner_seed: number;
  loser_seed: number;
  winner_games?: number;
  loser_games?: number;
}

export interface SeedingChangeLog {
  id: string;
  tournament_id: string;
  changed_by: string;
  change_type: 'reorder' | 'add' | 'delete' | 'rename' | 'bulk_import';
  affected_seeds: number[];
  description: string | null;
  created_at: string;
}

// Feedback types

export interface Feedback {
  id: string;
  message: string;
  page_url: string | null;
  created_at: string;
}

// Dashboard types

export interface DashboardBracket {
  id: string;
  name: string | null;
  tournament_id: string;
  tournament_name: string;
  tournament_state: string;
  tournament_year: number;
  player_count: number;
  lock_date: string;
  tournament_status: 'upcoming' | 'in_progress' | 'completed';
  pick_count: number;
  expected_picks: number;
  is_complete: boolean;
  is_public: boolean;
  score: number;
  rank: number | null;
  is_locked: boolean;
}
