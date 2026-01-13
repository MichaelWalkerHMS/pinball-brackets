# Feedback System

## Overview
Add an anonymous feedback system that allows users to submit feedback from any page. Feedback is stored in Supabase and viewable by admins through a new admin page.

## Requirements
- Feedback button visible in the header on all pages
- Simple modal/form with just a message textarea
- Store feedback in Supabase database
- Admin page to view all submitted feedback
- Truly anonymous (no user association, even for logged-in users)

## Technical Implementation

### Database Changes

#### New Migration: `feedback_table.sql`
```sql
-- Create feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  page_url TEXT, -- Optional: capture which page they were on
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (anonymous)
CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can view feedback
CREATE POLICY "Admins can view feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
```

### Files to Create

#### 1. `src/components/FeedbackButton.tsx`
Header button that opens the feedback modal.
```tsx
"use client";
// Renders a button (icon or text) that opens FeedbackModal
// Position: In header, prominent but not intrusive
```

#### 2. `src/components/FeedbackModal.tsx`
Modal with feedback form.
```tsx
"use client";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Contains:
// - Modal overlay
// - Title: "Send Feedback"
// - Textarea for message (required, min length validation)
// - Submit button
// - Cancel button
// - Success/error states
// - Captures current page URL automatically via window.location.pathname
```

#### 3. `src/app/feedback/actions.ts`
Server action to submit feedback.
```tsx
"use server";

export async function submitFeedback(formData: FormData) {
  const message = formData.get("message") as string;
  const pageUrl = formData.get("pageUrl") as string;

  // Validation
  if (!message || message.trim().length < 10) {
    return { error: "Please provide more detail in your feedback." };
  }

  // Insert into Supabase (using service role to bypass RLS for insert)
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .insert({ message: message.trim(), page_url: pageUrl });

  if (error) {
    return { error: "Failed to submit feedback. Please try again." };
  }

  return { success: true };
}
```

#### 4. `src/app/admin/feedback/page.tsx`
Admin page to view feedback.
```tsx
// Server component
// - Fetches all feedback ordered by created_at DESC
// - Displays in a table/list format
// - Shows: message (truncated), page_url, created_at
// - Click to expand full message
// - Optional: Delete button for cleanup
```

### Files to Modify

#### 1. `src/components/ResponsiveHeader.tsx`
Add FeedbackButton to the header.
```tsx
// Desktop: Add FeedbackButton next to NavLinks or SettingsButton
// Mobile: Add to MobileNav menu
```

#### 2. `src/lib/types/index.ts`
Add Feedback type.
```tsx
export interface Feedback {
  id: string;
  message: string;
  page_url: string | null;
  created_at: string;
}
```

#### 3. `src/lib/constants/navigation.ts`
Add feedback route to admin navigation (if one exists).

### UI Design Guidelines

#### Feedback Button
- Use a speech bubble or message icon
- Text: "Feedback" (can be icon-only on mobile)
- Colors: Use `--color-accent-primary` for visibility
- Position: Right side of header, before auth section

#### Feedback Modal
- Max width: 500px
- Textarea: Min height 120px, max 300px
- Character limit: Optional, maybe 1000 chars
- Placeholder: "Tell us what you think, report a bug, or suggest a feature..."
- Success state: "Thanks for your feedback!" then auto-close after 2 seconds

#### Admin Feedback Page
- Table columns: Date, Page, Message (truncated), Actions
- Expandable rows or modal for full message
- Empty state: "No feedback yet"
- Consider pagination if list gets long

### Data Flow
1. User clicks Feedback button in header
2. Modal opens with textarea
3. User enters message and submits
4. Server action inserts into `feedback` table
5. Success message shown, modal closes
6. Admin can view all feedback at `/admin/feedback`

## Testing Verification
1. Click Feedback button - modal should open
2. Submit empty/short message - should show validation error
3. Submit valid message - should show success and close
4. Check Supabase `feedback` table - new row should exist
5. Navigate to `/admin/feedback` as admin - should see the feedback
6. Navigate to `/admin/feedback` as non-admin - should be blocked
7. Test on mobile - button should be accessible
8. Run `npm run build` to ensure no TypeScript errors

## Reference Files
- `src/components/ResponsiveHeader.tsx` - Header structure
- `src/app/auth/actions.ts` - Example server action pattern
- `src/components/admin/AdminGuard.tsx` - Admin protection pattern
- `src/app/admin/tournament/[id]/page.tsx` - Example admin page structure
- Existing migrations in `supabase/migrations/` for RLS policy patterns
