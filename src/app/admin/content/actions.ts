"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FAQItem } from "@/lib/types";
import { logger, LogContext } from "@/lib/logger";

// Content length limits (in characters)
const MAX_PAGE_CONTENT_LENGTH = 100_000; // ~100KB for page content
const MAX_FAQ_QUESTION_LENGTH = 500;
const MAX_FAQ_ANSWER_LENGTH = 10_000; // ~10KB for FAQ answers

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
 * Update page content (about, privacy, changelog)
 */
export async function updatePageContent(
  slug: string,
  title: string,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  // Validate content length
  if (content.length > MAX_PAGE_CONTENT_LENGTH) {
    return {
      error: `Content exceeds maximum length of ${MAX_PAGE_CONTENT_LENGTH.toLocaleString()} characters`,
    };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("site_content")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("page_slug", slug);

  if (error) {
    logger.error(LogContext.CMS, "Failed to update page content", {
      slug,
      error: error.message,
    });
    return { error: error.message };
  }

  // Revalidate both the admin page and the public page
  revalidatePath(`/admin/content/${slug}`);
  revalidatePath(`/${slug}`);

  return { success: true };
}

/**
 * Add a new FAQ item
 */
export async function addFAQItem(
  question: string,
  answer: string
): Promise<{ item?: FAQItem; error?: string }> {
  // Validate content length
  if (question.length > MAX_FAQ_QUESTION_LENGTH) {
    return {
      error: `Question exceeds maximum length of ${MAX_FAQ_QUESTION_LENGTH} characters`,
    };
  }
  if (answer.length > MAX_FAQ_ANSWER_LENGTH) {
    return {
      error: `Answer exceeds maximum length of ${MAX_FAQ_ANSWER_LENGTH.toLocaleString()} characters`,
    };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Get the highest sort_order to add at the end
  const { data: lastItem } = await supabase
    .from("faq_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("faq_items")
    .insert({
      question,
      answer,
      sort_order: newSortOrder,
    })
    .select()
    .single();

  if (error) {
    logger.error(LogContext.CMS, "Failed to add FAQ item", {
      error: error.message,
    });
    return { error: error.message };
  }

  revalidatePath("/admin/content/faq");
  revalidatePath("/faq");

  return { item: data as FAQItem };
}

/**
 * Update an existing FAQ item
 */
export async function updateFAQItem(
  id: string,
  question: string,
  answer: string
): Promise<{ success?: boolean; error?: string }> {
  // Validate content length
  if (question.length > MAX_FAQ_QUESTION_LENGTH) {
    return {
      error: `Question exceeds maximum length of ${MAX_FAQ_QUESTION_LENGTH} characters`,
    };
  }
  if (answer.length > MAX_FAQ_ANSWER_LENGTH) {
    return {
      error: `Answer exceeds maximum length of ${MAX_FAQ_ANSWER_LENGTH.toLocaleString()} characters`,
    };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("faq_items")
    .update({
      question,
      answer,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    logger.error(LogContext.CMS, "Failed to update FAQ item", {
      id,
      error: error.message,
    });
    return { error: error.message };
  }

  revalidatePath("/admin/content/faq");
  revalidatePath("/faq");

  return { success: true };
}

/**
 * Delete a FAQ item
 */
export async function deleteFAQItem(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("faq_items").delete().eq("id", id);

  if (error) {
    logger.error(LogContext.CMS, "Failed to delete FAQ item", {
      id,
      error: error.message,
    });
    return { error: error.message };
  }

  revalidatePath("/admin/content/faq");
  revalidatePath("/faq");

  return { success: true };
}

/**
 * Reorder FAQ items by updating their sort_order values
 */
export async function reorderFAQItems(
  orderedIds: string[]
): Promise<{ success?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  // Update each item's sort_order based on its position in the array
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("faq_items")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);

  if (failed?.error) {
    logger.error(LogContext.CMS, "Failed to reorder FAQ items", {
      error: failed.error.message,
    });
    return { error: failed.error.message };
  }

  revalidatePath("/admin/content/faq");
  revalidatePath("/faq");

  return { success: true };
}
