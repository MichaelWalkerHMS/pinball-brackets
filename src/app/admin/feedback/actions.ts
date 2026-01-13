"use server";

import { createClient } from "@/lib/supabase/server";

export async function deleteFeedback(id: string) {
  if (!id) {
    return { error: "Feedback ID is required." };
  }

  const supabase = await createClient();

  // RLS will verify the user is an admin
  const { error } = await supabase
    .from("feedback")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete feedback:", error.message);
    return { error: "Failed to delete feedback. Please try again." };
  }

  return { success: true };
}
