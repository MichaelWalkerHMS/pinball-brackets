/**
 * Simple structured logger for consistent log formatting.
 *
 * Provides prefixed log messages for easier filtering in production.
 * Each log includes a context tag (e.g., "[Tournament Results]") and
 * optional structured data.
 */

type LogData = Record<string, unknown>;

function formatMessage(context: string, message: string, data?: LogData): [string, LogData | string] {
  const formatted = `[${context}] ${message}`;
  return [formatted, data ?? ""];
}

export const logger = {
  error: (context: string, message: string, data?: LogData) => {
    const [formatted, logData] = formatMessage(context, message, data);
    console.error(formatted, logData);
  },

  warn: (context: string, message: string, data?: LogData) => {
    const [formatted, logData] = formatMessage(context, message, data);
    console.warn(formatted, logData);
  },

  info: (context: string, message: string, data?: LogData) => {
    const [formatted, logData] = formatMessage(context, message, data);
    console.log(formatted, logData);
  },
};

// Common context constants for consistency
export const LogContext = {
  TOURNAMENT: "Tournament",
  TOURNAMENT_RESULTS: "Tournament Results",
  TOURNAMENT_PLAYERS: "Tournament Players",
  MATCH_PLAY: "Match Play",
  MATCH_PLAY_SYNC: "Match Play Sync",
  AUTH: "Auth",
  ADMIN: "Admin",
  CMS: "CMS",
  SCORING: "Scoring",
  FEEDBACK: "Feedback",
} as const;
