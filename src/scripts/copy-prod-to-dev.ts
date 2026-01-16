/**
 * Copy production data to dev database
 *
 * This script:
 * 1. BACKS UP dev tables to ./backups/ before any modifications
 * 2. READS from production (read-only operations only)
 * 3. WRITES to dev (clears and replaces data)
 *
 * Tables copied: tournaments, players
 * Backups saved to: ./backups/dev-backup-<timestamp>.json
 *
 * Usage: npx tsx src/scripts/copy-prod-to-dev.ts
 *        npx tsx src/scripts/copy-prod-to-dev.ts --dry-run
 *
 * Requires environment variables:
 * - PROD_SUPABASE_URL
 * - PROD_SUPABASE_SERVICE_KEY
 * - NEXT_PUBLIC_SUPABASE_URL (dev)
 * - SUPABASE_SERVICE_KEY (dev)
 */

import * as readline from "readline";
import * as fs from "fs/promises";
import * as path from "path";
import { config } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// Validate environment variables
const PROD_URL = process.env.PROD_SUPABASE_URL;
const PROD_KEY = process.env.PROD_SUPABASE_SERVICE_KEY;
const DEV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DEV_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!PROD_URL || !PROD_KEY) {
  console.error("Missing PROD_SUPABASE_URL or PROD_SUPABASE_SERVICE_KEY");
  console.error("Add these to your .env.local file:");
  console.error("  PROD_SUPABASE_URL=https://ynxmkbpdnucrbjyvovpq.supabase.co");
  console.error("  PROD_SUPABASE_SERVICE_KEY=<your-prod-service-role-key>");
  process.exit(1);
}

if (!DEV_URL || !DEV_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY for dev");
  process.exit(1);
}

// Safety check: make sure we're not accidentally pointing at the same database
if (PROD_URL === DEV_URL) {
  console.error("ERROR: PROD_URL and DEV_URL are the same! Aborting to prevent data loss.");
  process.exit(1);
}

console.log("=== Production to Dev Data Copy ===\n");
console.log(`Source (PROD): ${PROD_URL}`);
console.log(`Target (DEV):  ${DEV_URL}`);
console.log("");

// Create clients
const prodClient = createClient(PROD_URL, PROD_KEY);
const devClient = createClient(DEV_URL, DEV_KEY);

interface CopyStats {
  table: string;
  read: number;
  written: number;
  cleared: number;
}

const stats: CopyStats[] = [];

// Tables in dependency order (parents before children)
// Only syncing auth-independent tables to avoid FK constraints with auth.users
// Excluded: profiles, brackets, seeding_change_log (reference auth.users)
// Excluded: results (depends on brackets for meaningful data)
const TABLES_IN_ORDER = [
  "tournaments",
  "players",
] as const;

// Backup directory
const BACKUP_DIR = path.join(process.cwd(), "backups");

interface BackupData {
  timestamp: string;
  tables: Record<string, Record<string, unknown>[]>;
}

async function backupDevTables(
  client: SupabaseClient,
  tables: readonly string[],
  dryRun: boolean
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `dev-backup-${timestamp}.json`);

  const backupData: BackupData = {
    timestamp: new Date().toISOString(),
    tables: {},
  };

  let totalRows = 0;

  for (const table of tables) {
    console.log(`  Reading dev.${table}...`);
    const { data, error } = await client.from(table).select("*");

    if (error) {
      console.error(`  ERROR reading ${table}:`, error.message);
      throw error;
    }

    backupData.tables[table] = data || [];
    totalRows += data?.length || 0;
    console.log(`  Read ${data?.length || 0} rows from dev.${table}`);
  }

  if (totalRows === 0) {
    console.log("  No data to backup (all tables empty)");
    return null;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would save backup to ${backupFile}`);
    return null;
  }

  // Ensure backup directory exists
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // Write backup file
  await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`  Saved backup to ${backupFile}`);

  return backupFile;
}

async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function readFromProd<T>(
  client: SupabaseClient,
  table: string
): Promise<T[]> {
  console.log(`  Reading from prod.${table}...`);
  const { data, error } = await client.from(table).select("*");

  if (error) {
    console.error(`  ERROR reading ${table}:`, error.message);
    throw error;
  }

  console.log(`  Read ${data?.length || 0} rows from prod.${table}`);
  return (data || []) as T[];
}

async function clearDevTable(
  client: SupabaseClient,
  table: string,
  dryRun: boolean
): Promise<number> {
  console.log(`  Clearing dev.${table}...`);

  // Count existing rows first
  const { count } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (dryRun) {
    console.log(`  [DRY RUN] Would clear ${count || 0} rows from dev.${table}`);
    return count || 0;
  }

  // Delete all rows using a filter that matches any non-null id
  // This is more reliable than filtering on created_at which may not exist
  const { error } = await client
    .from(table)
    .delete()
    .not("id", "is", null);

  if (error) {
    console.error(`  ERROR clearing ${table}:`, error.message);
    throw error;
  }

  console.log(`  Cleared ${count || 0} rows from dev.${table}`);
  return count || 0;
}

async function writeToDev<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  data: T[],
  dryRun: boolean
): Promise<number> {
  if (data.length === 0) {
    console.log(`  No data to write to dev.${table}`);
    return 0;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would write ${data.length} rows to dev.${table}`);
    return data.length;
  }

  console.log(`  Writing ${data.length} rows to dev.${table}...`);

  // Insert in batches to avoid payload limits
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await client.from(table).insert(batch);

    if (error) {
      console.error(`  ERROR writing to ${table}:`, error.message);
      throw error;
    }

    written += batch.length;
  }

  console.log(`  Wrote ${written} rows to dev.${table}`);
  return written;
}

async function main() {
  if (DRY_RUN) {
    console.log("*** DRY RUN MODE - No changes will be made ***\n");
  }

  console.log("Starting data copy...\n");
  console.log("SAFETY: This script only READS from production.");
  console.log("        Only the DEV database will be modified.\n");

  // Confirmation prompt (skip in dry-run mode)
  if (!DRY_RUN) {
    const confirmed = await confirmAction(
      "This will DELETE all data in the dev database and replace it with production data.\n" +
        "Are you sure you want to continue? [y/N] "
    );

    if (!confirmed) {
      console.log("\nAborted by user.");
      process.exit(0);
    }
    console.log("");
  }

  try {
    // PHASE 0: Backup dev tables before any modifications
    console.log("=== Phase 0: Backing up dev tables ===\n");
    const backupFile = await backupDevTables(devClient, TABLES_IN_ORDER, DRY_RUN);
    if (backupFile) {
      console.log(`\nBackup saved. To restore if needed, use the backup file.`);
    }

    // PHASE 1: Read all data from production first
    // This ensures we have all the data before we start modifying dev
    console.log("\n=== Phase 1: Reading from production ===");
    const prodData: Record<string, Record<string, unknown>[]> = {};

    for (const table of TABLES_IN_ORDER) {
      console.log(`\n[${table}]`);
      prodData[table] = await readFromProd(prodClient, table);
    }

    // PHASE 2: Clear dev tables in REVERSE order (children before parents)
    // This respects foreign key constraints
    console.log("\n=== Phase 2: Clearing dev tables ===");
    const clearedCounts: Record<string, number> = {};
    const reversedTables = [...TABLES_IN_ORDER].reverse();

    for (const table of reversedTables) {
      console.log(`\n[${table}]`);
      clearedCounts[table] = await clearDevTable(devClient, table, DRY_RUN);
    }

    // PHASE 3: Write to dev tables in FORWARD order (parents before children)
    // This respects foreign key constraints
    console.log("\n=== Phase 3: Writing to dev tables ===");

    for (const table of TABLES_IN_ORDER) {
      console.log(`\n[${table}]`);
      const data = prodData[table];
      const written = await writeToDev(devClient, table, data, DRY_RUN);
      stats.push({
        table,
        read: data.length,
        written,
        cleared: clearedCounts[table],
      });
    }

    // Print summary
    console.log("\n=== Summary ===\n");
    console.log("Table                  | Read | Cleared | Written");
    console.log("-----------------------|------|---------|--------");
    for (const s of stats) {
      console.log(
        `${s.table.padEnd(22)} | ${String(s.read).padStart(4)} | ${String(s.cleared).padStart(7)} | ${String(s.written).padStart(7)}`
      );
    }

    if (DRY_RUN) {
      console.log("\n*** DRY RUN COMPLETE - No changes were made ***");
      console.log("Run without --dry-run to perform the actual copy.");
    } else {
      console.log("\nData copy complete!");
      console.log("Production was NOT modified (read-only).");
      console.log("Dev database has been updated with production data.");
    }
  } catch (error) {
    console.error("\nFailed to copy data:", error);
    process.exit(1);
  }
}

main();
