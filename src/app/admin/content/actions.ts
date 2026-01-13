"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FAQItem } from "@/lib/types";

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
    console.error("Error updating page content:", error);
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
    console.error("Error adding FAQ item:", error);
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
    console.error("Error updating FAQ item:", error);
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
    console.error("Error deleting FAQ item:", error);
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
    console.error("Error reordering FAQ items:", failed.error);
    return { error: failed.error.message };
  }

  revalidatePath("/admin/content/faq");
  revalidatePath("/faq");

  return { success: true };
}
