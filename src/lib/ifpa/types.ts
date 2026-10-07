// IFPA API v2.1 types (https://api.ifpapinball.com/docs/)
// The API returns nearly all numeric values as strings; mapping to numbers
// happens in headToHead.ts.

export interface IfpaPlayerStatsOpen {
  current_rank: string;
  ratings_rank: string;
  ratings_value: string;
}

export interface IfpaPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  initials: string | null;
  profile_photo: string | null;
  matchplay_events: {
    id: string;
    rating: string;
    rank: string;
  } | null;
  player_stats: {
    system: {
      open?: IfpaPlayerStatsOpen;
    };
  };
}

export interface IfpaPlayersResponse {
  player: IfpaPlayer[];
}

export interface IfpaPvpEvent {
  tournament_name: string;
  event_name: string;
  tournament_id: string;
  event_end_date: string;
  finish_position: {
    player_1: string;
    player_2: string;
  };
}

// When two players have never shared a tournament the API responds with
// HTTP 200 and { message, code: "404" } instead of a pvp array.
export interface IfpaPvpResponse {
  pvp?: IfpaPvpEvent[];
  message?: string;
  code?: string;
}

export class IfpaError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'IfpaError';
  }
}
