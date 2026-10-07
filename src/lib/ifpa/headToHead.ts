import type { IfpaPlayer, IfpaPvpEvent } from './types';

export interface PlayerStats {
  ifpaId: number;
  ifpaRank: number | null;
  ifpaRating: number | null;
  matchplayRating: number | null;
  photoUrl: string | null;
  pinballInitials: string | null;
}

export interface HeadToHeadMeeting {
  tournamentName: string;
  date: string;
  player1Finish: number;
  player2Finish: number;
}

export interface HeadToHeadRecord {
  player1Wins: number;
  player2Wins: number;
  ties: number;
}

export interface HeadToHead {
  // null when that player has no IFPA ID
  player1: PlayerStats | null;
  player2: PlayerStats | null;
  // null unless both players have IFPA IDs. IFPA's "PVP" counts a win for
  // whoever finished higher in a shared tournament, not direct game wins.
  record: HeadToHeadRecord | null;
  recentMeetings: HeadToHeadMeeting[];
}

const RECENT_MEETINGS_LIMIT = 5;

// IFPA uses "", "0", or null for unranked/unrated values
function toPositiveNumber(value: string | null | undefined): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? n : null;
}

const IFPA_PHOTO_PREFIX = 'https://www.ifpapinball.com/';

// IFPA returns "" when a player has no photo. The URL is rendered as an <img src>
// in the browser, so only accept IFPA-hosted images.
function toPhotoUrl(value: string | null | undefined): string | null {
  return value?.startsWith(IFPA_PHOTO_PREFIX) ? value : null;
}

function toPlayerStats(ifpaId: number | null, byId: Map<number, IfpaPlayer>): PlayerStats | null {
  if (ifpaId === null) return null;
  const player = byId.get(ifpaId);
  const open = player?.player_stats?.system?.open;
  const rating = toPositiveNumber(open?.ratings_value);
  return {
    ifpaId,
    ifpaRank: toPositiveNumber(open?.current_rank),
    ifpaRating: rating === null ? null : Math.round(rating),
    matchplayRating: toPositiveNumber(player?.matchplay_events?.rating),
    photoUrl: toPhotoUrl(player?.profile_photo),
    pinballInitials: player?.initials?.trim() || null,
  };
}

export function buildHeadToHead(
  player1Id: number | null,
  player2Id: number | null,
  players: IfpaPlayer[],
  pvp: IfpaPvpEvent[] | null
): HeadToHead {
  const byId = new Map(players.map((p) => [Number(p.player_id), p]));

  let record: HeadToHeadRecord | null = null;
  let meetings: HeadToHeadMeeting[] = [];

  if (pvp !== null) {
    const tally = { player1Wins: 0, player2Wins: 0, ties: 0 };
    meetings = pvp.map((event) => {
      const player1Finish = Number(event.finish_position.player_1);
      const player2Finish = Number(event.finish_position.player_2);
      if (player1Finish < player2Finish) tally.player1Wins++;
      else if (player2Finish < player1Finish) tally.player2Wins++;
      else tally.ties++;
      return {
        tournamentName: event.tournament_name,
        date: event.event_end_date,
        player1Finish,
        player2Finish,
      };
    });
    record = tally;
    // ISO dates sort correctly as strings
    meetings.sort((a, b) => b.date.localeCompare(a.date));
  }

  return {
    player1: toPlayerStats(player1Id, byId),
    player2: toPlayerStats(player2Id, byId),
    record,
    recentMeetings: meetings.slice(0, RECENT_MEETINGS_LIMIT),
  };
}
