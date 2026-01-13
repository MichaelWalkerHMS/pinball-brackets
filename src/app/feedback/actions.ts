"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(formData: FormData) {
  const message = formData.get("message") as string;
  const pageUrl = formData.get("pageUrl") as string;

  // Validation
  if (!message || message.trim().length < 1) {
    return { error: "Please enter a message." };
  }

  if (message.trim().length > 1000) {
    return { error: "Feedback is too long (max 1000 characters)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .insert({
      message: message.trim(),
      page_url: pageUrl || null,
    });

  if (error) {
    console.error("Failed to submit feedback:", error.message);
    return { error: "Failed to submit feedback. Please try again." };
  }

  return { success: true };
}
