"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TournamentFormData } from "@/lib/types";

/**
 * Get scoring configuration based on player count.
 * 24-player: Opening(1) + R16(2) + Quarters(3) + Semis(4) + Finals(5) = 53 max
 * 16-player: R16(1) + Quarters(2) + Semis(3) + Finals(4) = 29 max
 */
function getScoringConfig(playerCount: 16 | 24) {
  if (playerCount === 16) {
    return {
      opening: 0, // No opening round in 16-player
      round_of_16: 1,
      quarters: 2,
      semis: 3,
      finals: 4,
    };
  }
  // 24-player (default)
  return {
    opening: 1,
    round_of_16: 2,
    quarters: 3,
    semis: 4,
    finals: 5,
  };
}

/**
 * Verify the current user is an admin.
 * Returns the user if admin, or an error object if not.
 */
async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: "Not authorized" };
  }

  return { user };
}

/**
 * Create a new tournament
 */
export async function createTournament(data: TournamentFormData) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Convert datetime-local values to ISO strings with timezone
  const tournamentData = {
    name: data.name,
    state: data.state,
    year: data.year,
    start_date: new Date(data.start_date).toISOString(),
    end_date: new Date(data.end_date).toISOString(),
    player_count: data.player_count,
    timezone: data.timezone,
    matchplay_id: data.matchplay_id || null,
    status: "upcoming" as const,
    is_active: true,
    scoring_config: getScoringConfig(data.player_count),
  };

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .insert(tournamentData)
    .select()
    .single();

  if (error) {
    console.error("Error creating tournament:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { tournament };
}

/**
 * Update an existing tournament
 */
export async function updateTournament(
  id: string,
  data: Partial<TournamentFormData>
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Build update object, converting dates if provided
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.player_count !== undefined) {
    updateData.player_count = data.player_count;
    updateData.scoring_config = getScoringConfig(data.player_count);
  }
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.matchplay_id !== undefined)
    updateData.matchplay_id = data.matchplay_id || null;

  if (data.start_date !== undefined) {
    updateData.start_date = new Date(data.start_date).toISOString();
  }
  if (data.end_date !== undefined) {
    updateData.end_date = new Date(data.end_date).toISOString();
  }

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating tournament:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tournament/${id}`);
  return { tournament };
}

/**
 * Delete a tournament and all associated data
 */
export async function deleteTournament(id: string) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Check how many brackets exist for this tournament
  const { count } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", id);

  if (count && count > 0) {
    return {
      error: `Cannot delete tournament with ${count} bracket(s). Remove all brackets first.`,
    };
  }

  const { error } = await supabase.from("tournaments").delete().eq("id", id);

  if (error) {
    console.error("Error deleting tournament:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Update tournament status
 */
export async function updateTournamentStatus(
  id: string,
  status: "upcoming" | "in_progress" | "completed"
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating tournament status:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tournament/${id}`);
  return { success: true };
}

/**
 * Toggle tournament visibility (is_active)
 */
export async function toggleTournamentVisibility(id: string) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Get current visibility
  const { data: tournament, error: fetchError } = await supabase
    .from("tournaments")
    .select("is_active")
    .eq("id", id)
    .single();

  if (fetchError) {
    return { error: fetchError.message };
  }

  // Toggle it
  const { error } = await supabase
    .from("tournaments")
    .update({ is_active: !tournament.is_active })
    .eq("id", id);

  if (error) {
    console.error("Error toggling tournament visibility:", error);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tournament/${id}`);
  return { success: true, is_active: !tournament.is_active };
}
