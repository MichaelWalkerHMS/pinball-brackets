/**
 * Seed script for database
 *
 * Usage:
 *   npm run seed           # Uses .env.local (dev)
 *   npm run seed:prod      # Uses .env.prod (production)
 *
 * Requires environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY (service role key, not the publishable key)
 *
 * Get your service key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Prompt user for confirmation
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Load environment file
function loadEnv(envFile: string) {
  // nosemgrep: path-join-resolve-traversal -- CLI script, envFile from our own argv parsing
  const envPath = path.join(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    console.error(`Error: ${envFile} file not found`);
    process.exit(1);
  }

  console.log(`Loading environment from: ${envFile}\n`);

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

// Determine which env file to use based on command line argument
const envFile = process.argv[2] || '.env.local';

loadEnv(envFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL not set in .env.local');
  process.exit(1);
}

if (!serviceKey) {
  console.error('Error: SUPABASE_SERVICE_KEY not set in .env.local');
  console.error('Add your service role key from Supabase Dashboard → Project Settings → API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Tournament data for 2026 Michigan State Championship
const TOURNAMENT_DATA = {
  name: '2026 Michigan State Championship',
  state: 'MI',
  year: 2026,
  start_date: '2026-01-17T13:00:00-05:00',
  end_date: '2026-01-18T20:00:00-05:00',
  player_count: 24,
  status: 'upcoming' as const,
  is_active: true,
  timezone: 'America/New_York',
  scoring_config: {
    opening: 1,
    round_of_16: 2,
    quarters: 3,
    semis: 4,
    finals: 5,
  },
};

// 2025 NACS Michigan qualifying (Attending/Unknown only, excludes "Not Attending")
// Source: https://www.ifpapinball.com/series/nacs/2025/qualifying.php?year=2025&s=MI
const PLAYER_NAMES = [
  'Dominic Labella',
  'Matthew Stacks',
  'Rodney Minch',
  'Tyrus Eagle',
  'Daniel Overbeek',
  'Michael Walker',
  'Andy Rosa',
  'Justin Stone',
  'Ethan Magnum',
  'Jared August',
  'Aaron Niemi',
  'Jason Humphrey',
  'Meredith Walton',
  'Chris Tabaka',
  'Phil Harmon',
  'Alex Harmon',
  'Philip Salminen',
  'Stacey Siegel',
  'Jim Droski',
  'Tom Deemter',
  'Evan Williams',
  'Nick Campbell',
  'Alex Darling',
  'Arthur Ruple',
];

async function seed() {
  console.log('Seeding development database...\n');

  // Check if tournament already exists
  const { data: existingTournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('name', TOURNAMENT_DATA.name)
    .single();

  if (existingTournament) {
    console.log('Tournament already exists:', TOURNAMENT_DATA.name);
    console.log('Tournament ID:', existingTournament.id);
    console.log('\nWARNING: This will delete the existing tournament and ALL associated data');
    console.log('(players, brackets, picks). This cannot be undone.\n');

    const confirmed = await confirm('Delete existing tournament and re-seed? (y/n): ');

    if (!confirmed) {
      console.log('Aborted. No changes made.');
      process.exit(0);
    }

    // Delete existing tournament (cascades to players, brackets, picks)
    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', existingTournament.id);

    if (deleteError) {
      console.error('Failed to delete existing tournament:', deleteError.message);
      process.exit(1);
    }
    console.log('Deleted existing tournament.\n');
  }

  // Insert tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert(TOURNAMENT_DATA)
    .select()
    .single();

  if (tournamentError) {
    console.error('Failed to create tournament:', tournamentError.message);
    process.exit(1);
  }

  console.log('Created tournament:', tournament.name);
  console.log('Tournament ID:', tournament.id);

  // Insert players
  const playersToInsert = PLAYER_NAMES.map((name, index) => ({
    tournament_id: tournament.id,
    name,
    seed: index + 1,
  }));

  const { error: playersError } = await supabase
    .from('players')
    .insert(playersToInsert);

  if (playersError) {
    console.error('Failed to create players:', playersError.message);
    process.exit(1);
  }

  console.log(`Created ${PLAYER_NAMES.length} players (seeds 1-24)\n`);

  // Display seeding
  console.log('Player Seeding:');
  console.log('---------------');
  PLAYER_NAMES.forEach((name, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${name}`);
  });

  console.log('\nSeed complete!');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  console.log(`\nYou can now visit: ${baseUrl}/tournament/${tournament.id}`);
}

seed().catch(console.error);
