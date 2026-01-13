import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Feedback } from "@/lib/types";
import FeedbackList from "./FeedbackList";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();

  const { data: feedback, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch feedback:", error.message);
  }

  const typedFeedback = (feedback || []) as Feedback[];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/admin" className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm">
          &larr; Back to Tournaments
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
          User Feedback
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))] mt-1">
          {typedFeedback.length} feedback submission{typedFeedback.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Feedback List */}
      <FeedbackList feedback={typedFeedback} />
    </div>
  );
}
