import { createClient } from "@/lib/supabase/server";
import type { SiteContent, FAQItem } from "@/lib/types";

/**
 * Fetch page content by slug.
 * Returns null if the page doesn't exist.
 */
export async function getPageContent(slug: string): Promise<SiteContent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("page_slug", slug)
    .single();

  if (error) {
    // PGRST116 = no rows returned, which is expected for missing content
    if (error.code !== "PGRST116") {
      // nosemgrep: unsafe-formatstring -- slug is from internal routing, not user input
      console.error(`Error fetching page content for ${slug}:`, error);
    }
    return null;
  }

  return data as SiteContent;
}

/**
 * Fetch all FAQ items ordered by sort_order.
 */
export async function getFAQItems(): Promise<FAQItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faq_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching FAQ items:", error);
    return [];
  }

  return (data || []) as FAQItem[];
}

/**
 * Fetch all editable pages for the admin content dashboard.
 */
export async function getAllPageContent(): Promise<SiteContent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .order("page_slug", { ascending: true });

  if (error) {
    console.error("Error fetching all page content:", error);
    return [];
  }

  return (data || []) as SiteContent[];
}
