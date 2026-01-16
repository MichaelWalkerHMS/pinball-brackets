/**
 * Import State Tournaments from CSV
 *
 * This script reads a CSV file and imports tournaments that have Match Play URLs.
 * It uses the existing Match Play library functions from src/lib/matchplay/.
 *
 * WHAT IT DOES:
 * 1. Parses CSV to find rows with Match Play URLs (e.g., app.matchplay.events/tournaments/12345)
 * 2. Checks if tournament already exists by matchplay_id (NOT by state - allows multiple per state)
 * 3. Fetches tournament details, players, and results from Match Play API
 * 4. Creates tournament in database with name from Match Play (not hardcoded)
 * 5. Imports players and any completed results
 *
 * CSV FORMAT:
 * The script auto-detects columns by header name. Required columns:
 *   - Country (or "kf"): USA or CAN
 *   - State/Province: Full state name (e.g., "Michigan", "North Carolina")
 *   - Bracket: Match Play URL (e.g., https://app.matchplay.events/tournaments/229402)
 *
 * DEFAULT CSV: feature-plans/add-states/bracket-list.csv
 *
 * DUPLICATE HANDLING:
 * - Duplicates are detected by matchplay_id, NOT by state
 * - This allows multiple tournaments per state (e.g., Open + Women's)
 * - If a tournament with the same Match Play ID exists, it's skipped
 *
 * COMMON ERRORS:
 * - "No active players found": Tournament exists in Match Play but has no seeded players yet
 * - "Too many players: X > Y": Bracket size doesn't match 16 or 24 player format
 * - "Unsupported bracket size": Match Play bracket isn't 16 or 32 (our app needs 16 or 24 players)
 *
 * USAGE:
 *   npx tsx src/scripts/import-state-tournaments.ts                              # Default CSV, dev
 *   npx tsx src/scripts/import-state-tournaments.ts --csv path/to/file.csv       # Custom CSV
 *   npx tsx src/scripts/import-state-tournaments.ts --prod                       # Production
 *   npx tsx src/scripts/import-state-tournaments.ts --dry-run                    # Preview only
 *   npx tsx src/scripts/import-state-tournaments.ts --csv path/to/file.csv --prod
 *
 * NPM SHORTCUTS:
 *   npm run import-states       # Dev with default CSV
 *   npm run import-states:dry   # Dry run preview
 *
 * ENVIRONMENT VARIABLES (from .env.local or .env.prod):
 *   NEXT_PUBLIC_SUPABASE_URL  - Supabase project URL
 *   SUPABASE_SERVICE_KEY      - Service role key (not the anon key)
 *   MATCHPLAY_API_TOKEN       - Match Play API token from matchplay.events
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Import existing Match Play library functions
import { MatchPlayClient } from "../lib/matchplay/client";
import { mapMatchPlayPlayers } from "../lib/matchplay/playerMapper";
import { mapMatchPlayGames } from "../lib/matchplay/resultMapper";
import type { MatchPlayPlayer } from "../lib/matchplay/types";

// ============================================================================
// Types
// ============================================================================

interface CsvRow {
  country: string;
  state: string;
  bracket: string;
  stream: string;
  ifpa: string;
}

interface ImportResult {
  state: string;
  country: string;
  matchplayId: string;
  status: "created" | "skipped" | "error";
  message: string;
  tournamentId?: string;
  playersImported?: number;
  resultsImported?: number;
}

// ============================================================================
// Environment Setup
// ============================================================================

function loadEnv(envFile: string) {
  // nosemgrep: path-join-resolve-traversal -- CLI script, envFile from our own argv parsing
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    console.error(`Error: ${envFile} file not found`);
    process.exit(1);
  }

  console.log(`Loading environment from: ${envFile}\n`);

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

// ============================================================================
// CSV Parsing
// ============================================================================

function parseCsv(filepath: string): CsvRow[] {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length === 0) return [];

  // Parse header to find column indices
  const header = lines[0].toLowerCase();
  const headerParts = header.split(",").map((h) => h.trim());

  // Find column indices (support different header names)
  const countryIdx = headerParts.findIndex((h) => h.includes("country") || h === "kf");
  const stateIdx = headerParts.findIndex((h) => h.includes("state") || h.includes("province"));
  const bracketIdx = headerParts.findIndex((h) => h.includes("bracket"));

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    // Simple CSV parsing (handles basic cases)
    const parts = line.split(",");
    return {
      country: countryIdx >= 0 ? parts[countryIdx]?.trim() || "" : "",
      state: stateIdx >= 0 ? parts[stateIdx]?.trim() || "" : "",
      bracket: bracketIdx >= 0 ? parts[bracketIdx]?.trim() || "" : "",
      stream: "",
      ifpa: "",
    };
  });
}

// ============================================================================
// Match Play URL Parsing
// ============================================================================

function extractMatchPlayId(url: string): string | null {
  if (!url || !url.includes("matchplay")) {
    return null;
  }

  // Handle various URL formats:
  // https://app.matchplay.events/tournaments/229402
  // https://app.matchplay.events/tournaments/224913/bracket
  // https://matchplay.live/2025-ifpa-wnacs-tn (custom URL - skip)
  const match = url.match(/\/tournaments\/(\d+)/);
  if (match) {
    return match[1];
  }

  return null;
}

// ============================================================================
// Scoring Config
// ============================================================================

function getScoringConfig(playerCount: 16 | 24) {
  if (playerCount === 16) {
    return {
      opening: 0,
      round_of_16: 1,
      quarters: 2,
      semis: 3,
      finals: 4,
    };
  }
  return {
    opening: 1,
    round_of_16: 2,
    quarters: 3,
    semis: 4,
    finals: 5,
  };
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function importTournament(
  supabase: SupabaseClient,
  mpClient: MatchPlayClient,
  row: CsvRow,
  matchplayId: string,
  dryRun: boolean
): Promise<ImportResult> {
  const result: ImportResult = {
    state: row.state,
    country: row.country,
    matchplayId,
    status: "error",
    message: "",
  };

  try {
    // Check if this specific Match Play tournament already exists (by matchplay_id)
    // Note: Multiple tournaments per state are allowed (e.g., Women's + Open)
    const { data: existing } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("matchplay_id", matchplayId)
      .maybeSingle();

    if (existing) {
      result.status = "skipped";
      result.message = `Tournament already exists: ${existing.name} (MP ID: ${matchplayId})`;
      return result;
    }

    // Fetch tournament details from Match Play using existing library
    console.log(`  Fetching Match Play tournament ${matchplayId}...`);
    const mpTournament = await mpClient.getTournamentWithPlayers(matchplayId);

    // Determine player count from bracket size
    let playerCount: 16 | 24;
    if (mpTournament.bracketSize === 16) {
      playerCount = 16;
    } else if (mpTournament.bracketSize === 32) {
      playerCount = 24;
    } else {
      result.status = "error";
      result.message = `Unsupported bracket size: ${mpTournament.bracketSize}`;
      return result;
    }

    // Map players using existing library function
    const mappedPlayers = mapMatchPlayPlayers(mpTournament.players);
    if (mappedPlayers.length === 0) {
      result.status = "error";
      result.message = "No active players found";
      return result;
    }

    if (mappedPlayers.length > playerCount) {
      result.status = "error";
      result.message = `Too many players: ${mappedPlayers.length} > ${playerCount}`;
      return result;
    }

    // Calculate dates (use Match Play start time, or default to a month from now)
    // Note: Match Play returns startUtc in the tournament data
    const mpData = mpTournament as unknown as { startUtc?: string };
    const startDate = mpData.startUtc
      ? new Date(mpData.startUtc)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Lock date = start date
    const lockDate = startDate;

    // End date = start date + 10 hours
    const endDate = new Date(startDate.getTime() + 10 * 60 * 60 * 1000);

    // Use the actual tournament name from Match Play
    const tournamentName = mpTournament.name;

    if (dryRun) {
      result.status = "created";
      result.message = `[DRY RUN] Would create: ${tournamentName} (${playerCount} players)`;
      result.playersImported = mappedPlayers.length;
      return result;
    }

    // Create tournament
    console.log(`  Creating tournament: ${tournamentName}`);
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({
        name: tournamentName,
        state: row.state,
        year: 2025,
        lock_date: lockDate.toISOString(),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        player_count: playerCount,
        timezone: "America/New_York", // Default - can be adjusted
        matchplay_id: matchplayId,
        status: "upcoming",
        is_active: true,
        scoring_config: getScoringConfig(playerCount),
      })
      .select()
      .single();

    if (tournamentError || !tournament) {
      result.status = "error";
      result.message = `Failed to create tournament: ${tournamentError?.message}`;
      return result;
    }

    result.tournamentId = tournament.id;

    // Import players
    console.log(`  Importing ${mappedPlayers.length} players...`);
    const playersToInsert = mappedPlayers.map((p) => ({
      tournament_id: tournament.id,
      name: p.name,
      seed: p.seed,
      matchplay_id: p.matchplay_id,
      ifpa_id: p.ifpa_id,
    }));

    const { error: playersError } = await supabase
      .from("players")
      .insert(playersToInsert);

    if (playersError) {
      result.status = "error";
      result.message = `Failed to import players: ${playersError.message}`;
      return result;
    }

    result.playersImported = mappedPlayers.length;

    // Fetch and import results using existing library functions
    console.log(`  Fetching completed games...`);
    const games = await mpClient.getCompletedGames(matchplayId);

    if (games.length > 0) {
      // Use the existing mapMatchPlayGames function
      const { results: mappedResults, skipped } = mapMatchPlayGames(
        games,
        mpTournament.players as MatchPlayPlayer[],
        playerCount
      );

      if (skipped.length > 0) {
        console.log(`  Skipped ${skipped.length} games during mapping`);
      }

      if (mappedResults.length > 0) {
        console.log(`  Importing ${mappedResults.length} results...`);
        const resultsToInsert = mappedResults.map((r) => ({
          tournament_id: tournament.id,
          round: r.round,
          match_position: r.match_position,
          winner_seed: r.winner_seed,
          loser_seed: r.loser_seed,
          winner_games: r.winner_games,
          loser_games: r.loser_games,
        }));

        const { error: resultsError } = await supabase
          .from("results")
          .upsert(resultsToInsert, {
            onConflict: "tournament_id,round,match_position",
          });

        if (resultsError) {
          console.warn(`  Warning: Failed to import some results: ${resultsError.message}`);
        } else {
          result.resultsImported = mappedResults.length;
        }
      }
    }

    result.status = "created";
    result.message = `Created successfully`;
    return result;
  } catch (error) {
    result.status = "error";
    result.message = `Error: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const isProd = args.includes("--prod");

  // Parse --csv argument
  const csvArgIdx = args.indexOf("--csv");
  const csvArg = csvArgIdx >= 0 ? args[csvArgIdx + 1] : null;

  // Default CSV path
  const defaultCsvPath = "feature-plans/add-states/bracket-list.csv";
  const csvPath = csvArg
    ? path.isAbsolute(csvArg) ? csvArg : path.join(process.cwd(), csvArg)
    : path.join(process.cwd(), defaultCsvPath);

  // Environment file
  const envFile = isProd ? ".env.prod" : ".env.local";

  console.log("=".repeat(60));
  console.log("Import State Tournaments from CSV");
  console.log("=".repeat(60));

  if (isProd) {
    console.log("\n*** PRODUCTION MODE ***\n");
  }

  if (dryRun) {
    console.log("\n*** DRY RUN MODE - No changes will be made ***\n");
  }

  // Load environment
  loadEnv(envFile);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const matchplayToken = process.env.MATCHPLAY_API_TOKEN;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY required"
    );
    process.exit(1);
  }

  if (!matchplayToken) {
    console.error("Error: MATCHPLAY_API_TOKEN required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Use the existing MatchPlayClient from the library
  const mpClient = new MatchPlayClient(matchplayToken);

  // Read CSV
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Reading CSV: ${csvPath}\n`);
  const rows = parseCsv(csvPath);

  // Filter to rows with Match Play URLs
  const rowsWithMatchPlay = rows
    .map((row) => ({
      row,
      matchplayId: extractMatchPlayId(row.bracket),
    }))
    .filter((item) => item.matchplayId !== null);

  console.log(
    `Found ${rowsWithMatchPlay.length} rows with Match Play URLs\n`
  );

  // Process each row
  const results: ImportResult[] = [];

  for (const { row, matchplayId } of rowsWithMatchPlay) {
    console.log(`Processing: ${row.state} (${row.country})`);
    const result = await importTournament(
      supabase,
      mpClient,
      row,
      matchplayId!,
      dryRun
    );
    results.push(result);
    console.log(`  -> ${result.status}: ${result.message}\n`);
  }

  // Summary
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const created = results.filter((r) => r.status === "created");
  const skipped = results.filter((r) => r.status === "skipped");
  const errors = results.filter((r) => r.status === "error");

  console.log(`\nCreated: ${created.length}`);
  for (const r of created) {
    console.log(
      `  - ${r.state}: ${r.playersImported} players, ${r.resultsImported || 0} results`
    );
  }

  console.log(`\nSkipped: ${skipped.length}`);
  for (const r of skipped) {
    console.log(`  - ${r.state}: ${r.message}`);
  }

  console.log(`\nErrors: ${errors.length}`);
  for (const r of errors) {
    console.log(`  - ${r.state}: ${r.message}`);
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
