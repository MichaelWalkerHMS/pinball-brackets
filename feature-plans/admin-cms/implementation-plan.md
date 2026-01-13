# Admin CMS for Static Pages

## Overview
Create a simple content management system allowing admins to edit the About, FAQ, Privacy Policy, and Changelog pages through the admin panel. Content is stored in Supabase and rendered on the public pages.

This also establishes a pattern where Claude agents can update the changelog programmatically after implementing major features.

## Requirements
- Admin can edit About, Privacy Policy, and Changelog using markdown textareas
- Admin can edit FAQ using structured Q&A fields (add/edit/reorder/delete items)
- Public pages render content from database instead of hardcoded JSX
- Changelog should be editable both via admin UI AND programmatically (for Claude agents)
- Preserve existing page styling and layout

## Technical Implementation

### Database Changes

#### New Migration: `site_content.sql`
```sql
-- Site content table for markdown pages (About, Privacy, Changelog)
CREATE TABLE site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug TEXT UNIQUE NOT NULL, -- 'about', 'privacy', 'changelog'
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown content
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- FAQ items table (separate for structured Q&A)
CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL, -- Can contain markdown
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for site_content
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read site content
CREATE POLICY "Anyone can read site content"
  ON site_content FOR SELECT
  TO public
  USING (true);

-- Only admins can update site content
CREATE POLICY "Admins can update site content"
  ON site_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Only admins can insert site content (for initial setup)
CREATE POLICY "Admins can insert site content"
  ON site_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for faq_items
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read FAQ items
CREATE POLICY "Anyone can read faq items"
  ON faq_items FOR SELECT
  TO public
  USING (true);

-- Only admins can manage FAQ items
CREATE POLICY "Admins can manage faq items"
  ON faq_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Seed initial content from existing pages
INSERT INTO site_content (page_slug, title, content) VALUES
('about', 'About MI IFPA Bracket Predictor', '## What is this?
... (copy from existing about page)'),
('privacy', 'Privacy Policy', '... (copy from existing privacy page)'),
('changelog', 'Changelog', '... (copy from existing changelog page)');

-- Seed FAQ items from existing page
INSERT INTO faq_items (question, answer, sort_order) VALUES
('Question 1', 'Answer 1', 0),
('Question 2', 'Answer 2', 1);
-- ... continue for all existing FAQs
```

### Files to Create

#### 1. `src/lib/types/content.ts`
Type definitions for CMS content.
```tsx
export interface SiteContent {
  id: string;
  page_slug: string;
  title: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

#### 2. `src/lib/content/index.ts`
Helper functions to fetch content.
```tsx
import { createClient } from "@/lib/supabase/server";

export async function getPageContent(slug: string): Promise<SiteContent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_content")
    .select("*")
    .eq("page_slug", slug)
    .single();
  return data;
}

export async function getFAQItems(): Promise<FAQItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_items")
    .select("*")
    .order("sort_order", { ascending: true });
  return data || [];
}
```

#### 3. `src/components/MarkdownRenderer.tsx`
Component to render markdown content.
```tsx
// Use a markdown library like 'marked' or 'react-markdown'
// Apply existing page styles to rendered content
// Handle basic markdown: headers, paragraphs, lists, links, code blocks
```

#### 4. `src/app/admin/content/page.tsx`
Admin content dashboard listing all editable pages.
```tsx
// Links to edit each page:
// - /admin/content/about
// - /admin/content/faq
// - /admin/content/privacy
// - /admin/content/changelog
```

#### 5. `src/app/admin/content/[slug]/page.tsx`
Generic markdown content editor for About, Privacy, Changelog.
```tsx
// Fetches content by slug
// Shows title input and markdown textarea
// Preview button to see rendered output
// Save button to update
// Last updated timestamp display
```

#### 6. `src/app/admin/content/faq/page.tsx`
Specialized FAQ editor with structured fields.
```tsx
// Lists all FAQ items with question preview
// Add new item button
// Each item has:
//   - Question input
//   - Answer textarea (markdown)
//   - Drag handle for reordering (or up/down buttons)
//   - Delete button
// Save all button
```

#### 7. `src/app/admin/content/actions.ts`
Server actions for content management.
```tsx
"use server";

export async function updatePageContent(slug: string, title: string, content: string) {
  // Validate admin access
  // Update site_content table
  // Return success/error
}

export async function updateFAQItems(items: FAQItem[]) {
  // Validate admin access
  // Delete all existing items and insert new ones (or use upsert)
  // Return success/error
}

export async function addFAQItem(question: string, answer: string) { ... }
export async function deleteFAQItem(id: string) { ... }
export async function reorderFAQItems(orderedIds: string[]) { ... }
```

### Files to Modify

#### 1. `src/app/about/page.tsx`
Change from hardcoded to database-driven.
```tsx
// Before: Hardcoded JSX content
// After:
import { getPageContent } from "@/lib/content";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export default async function AboutPage() {
  const content = await getPageContent("about");

  return (
    <div className="...existing-styles">
      <ResponsiveHeader />
      <h1>{content?.title}</h1>
      <MarkdownRenderer content={content?.content || ""} />
    </div>
  );
}
```

#### 2. `src/app/faq/page.tsx`
Change from hardcoded array to database-driven.
```tsx
import { getFAQItems } from "@/lib/content";

export default async function FAQPage() {
  const faqItems = await getFAQItems();

  return (
    <div className="...existing-styles">
      <FAQAccordion items={faqItems} />
    </div>
  );
}
```

#### 3. `src/app/privacy/page.tsx`
Same pattern as About page.

#### 4. `src/app/changelog/page.tsx`
Same pattern as About page.

#### 5. `src/components/FAQAccordion.tsx`
Update to accept `FAQItem[]` type from database.
```tsx
// May need minor type adjustments to match database schema
```

#### 6. `src/app/admin/layout.tsx` or admin navigation
Add link to Content Management section.

### Markdown Library Setup
Install a markdown renderer:
```bash
npm install react-markdown
# or
npm install marked
```

### UI Design Guidelines

#### Content Editor (About, Privacy, Changelog)
- Full-width textarea, min-height 400px
- Monospace font for markdown editing
- Preview toggle/tab to see rendered output
- Auto-save indicator or explicit Save button
- "Last updated: [date] by [admin name]" footer

#### FAQ Editor
- Drag-and-drop reordering (use `@dnd-kit/core` or simple up/down buttons)
- Collapsible FAQ items to see question only
- Inline editing when expanded
- Add item at bottom with "Add FAQ" button
- Confirm dialog before deleting

### Programmatic Changelog Updates (for Claude Agents)

The changelog can be updated via:
1. **Direct Supabase update** using service role key (for scripts/migrations)
2. **Server action** `updatePageContent("changelog", title, content)` - requires admin auth
3. **API route** (optional) - create `POST /api/admin/content` for programmatic access

For Claude agents to update changelog after features:
- Read current content: Query `site_content` where `page_slug = 'changelog'`
- Prepend new version entry to content
- Update via server action or direct DB update

Example changelog format (markdown):
```markdown
## Version 1.2.0 - January 2026
- Added MatchPlay linked indicator on bracket pages
- Added feedback system for user suggestions
- Added admin CMS for editing static pages

## Version 1.1.0 - December 2025
...
```

## Testing Verification
1. Navigate to `/admin/content` - should see list of editable pages
2. Edit About page content - save and verify on public `/about`
3. Edit FAQ - add, reorder, delete items - verify on public `/faq`
4. Edit Privacy and Changelog - verify on public pages
5. Test markdown rendering (headers, lists, links, code blocks)
6. Verify non-admins cannot access `/admin/content/*`
7. Run `npm run build` to ensure no TypeScript errors

## CLAUDE.md Update
After this feature is implemented, add to CLAUDE.md:

```markdown
## Changelog Management
After implementing a major feature, update the changelog:
1. Read current changelog content from `site_content` table (page_slug = 'changelog')
2. Prepend new version entry with date and feature list
3. Update via the `updatePageContent` server action or direct DB update
```

## Reference Files
- `src/app/about/page.tsx` - Current about page structure (will be modified)
- `src/app/faq/page.tsx` - Current FAQ page with accordion
- `src/components/FAQAccordion.tsx` - Existing accordion component
- `src/app/admin/tournament/[id]/page.tsx` - Example admin page with tabs
- `src/app/admin/actions.ts` - Admin server action patterns
- `supabase/migrations/` - Migration file patterns
