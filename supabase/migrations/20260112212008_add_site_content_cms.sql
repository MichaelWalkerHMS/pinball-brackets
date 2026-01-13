-- Migration: Add site content CMS tables
-- Purpose: Enable admin editing of static pages (About, Privacy, Changelog, FAQ)

-- Site content table for markdown pages
CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug text UNIQUE NOT NULL, -- 'about', 'privacy', 'changelog'
  title text NOT NULL,
  content text NOT NULL, -- Markdown content
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- FAQ items table (separate for structured Q&A)
CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL, -- Can contain markdown
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_site_content_slug ON site_content(page_slug);
CREATE INDEX idx_faq_items_sort_order ON faq_items(sort_order);

-- Enable Row Level Security
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;

-- Site content policies
-- Anyone can read site content
CREATE POLICY "Anyone can read site content"
  ON site_content FOR SELECT
  TO public
  USING (true);

-- Only admins can update site content
CREATE POLICY "Admins can update site content"
  ON site_content FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Only admins can insert site content
CREATE POLICY "Admins can insert site content"
  ON site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- FAQ items policies
-- Anyone can read FAQ items
CREATE POLICY "Anyone can read faq items"
  ON faq_items FOR SELECT
  TO public
  USING (true);

-- Only admins can manage FAQ items (all operations)
CREATE POLICY "Admins can insert faq items"
  ON faq_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update faq items"
  ON faq_items FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete faq items"
  ON faq_items FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Grant permissions
GRANT SELECT ON site_content TO anon;
GRANT SELECT ON site_content TO authenticated;
GRANT INSERT, UPDATE ON site_content TO authenticated;

GRANT SELECT ON faq_items TO anon;
GRANT SELECT ON faq_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON faq_items TO authenticated;

-- Seed initial content from existing pages
INSERT INTO site_content (page_slug, title, content) VALUES
('about', 'About', '## What is this?

This is something I wanted for myself, and I figured there may be a few other pinball players that would like to make some brackets too.

My name is Michael Walker - I''m a pinball player in Michigan that''s getting ready for my first State Championship tournament this January. Last year, I was frustrated when I couldn''t find an easy, free way to fill out a prediction bracket while I watched my friends play in the IFPA State Championship tournament.

This year, I had a little time to kill over the Christmas break and decided to finally give Claude Code a try and see what the hype is about. This site is the result of that side project. I gave the direction and iterated through bug fixes/design/etc., but all code was created by Anthropic''s Claude Code terminal/agent. It''s been fun.

All code is visible on [GitHub](https://github.com/MichaelWalkerHMS/MI-IFPA-Bracket) - I am going to continue to make frequent changes as I find things that I want to improve or as I receive feedback. Visit the [changelog](/changelog) for recent changes and future ideas.

## How it works

1. Select a tournament from the available state championships - in the beginning, it may only be Michigan. I expect to expand to other states in the future (it''s the results that are the hard part).
2. Create your bracket by predicting the winner of each match
3. Submit your bracket before the tournament locks
4. Watch the tournament - you''ll get points for how well you predict the results
5. Check the leaderboard to see how you compare to others

## Scoring

Points are awarded for each correct prediction, with later rounds worth more points.

**24-player tournaments (53 points max):**
- Opening Round: 1 point
- Round of 16: 2 points
- Quarterfinals: 3 points
- Semifinals: 4 points
- Finals: 5 points
- 3rd/4th Place: 4 points

**16-player tournaments (29 points max):**
- Round of 16: 1 point
- Quarterfinals: 2 points
- Semifinals: 3 points
- Finals: 4 points
- 3rd/4th Place: 3 points'),

('privacy', 'Privacy Policy', '## In Plain English

This is a bracket app, not a banking application - I have no interest nor reason to grab a bunch of data from you, so I''m not.

I''ve had Claude write up more detail below based on the actual code, but this is how I would say it: this site collects your name (which you could fake, I don''t care), your email address (which could be fake, it''ll just make it impossible to reset your password), and your bracket predictions (which is the whole point of the site). Any other data that''s collected is only there to facilitate the function of the site.

I''m never going to sell or give away any of this incredibly limited data. I''m not going to email you or spam you - the only emails I''m aware you could even receive is if you want to reset your password.

## Data We Collect

When you create an account and use Pinball Brackets, we collect:

- Email address (for authentication)
- Display name (shown on leaderboards)
- Your bracket predictions

## How We Use Your Data

Your data is used to:

- Authenticate you and maintain your session
- Store and display your bracket predictions
- Calculate and display leaderboard rankings
- Display your name on public brackets (if you choose to make them public)

## Third-Party Services

We use the following third-party services:

- **Supabase** - For authentication and database storage. Your email and data are stored securely on Supabase servers.
- **Vercel** - For hosting the application. Standard server logs may be collected.

## Public vs Private Brackets

When you create a bracket, you can choose to make it public or private:

- **Public brackets** are visible to anyone and appear on the leaderboard with your display name
- **Private brackets** are only visible to you and do not appear on the public leaderboard

## Data Retention

Your account and bracket data are retained as long as you maintain your account.'),

('changelog', 'Changelog', '## 1.0.1

- Implemented initial services for calling Match Play API to build tournaments and import results

## 1.0

- Initial launch with Michigan Open and Women''s brackets

## Future Ideas

- Auto import results from Matchplay tournaments (where available)
- Add additional states (likely prioritizing states with brackets on Matchplay)
- Improve bracket creation on mobile - wizard view instead of scrollable bracket
- Improve text that displays when links are shared - it''s dull today, needs to be more personalized');

-- Seed FAQ items
INSERT INTO faq_items (question, answer, sort_order) VALUES
('How does scoring work?', 'Points are awarded for each correct prediction, with later rounds worth more points.

**24-player tournaments (53 points max):**
- Opening Round: 1 point
- Round of 16: 2 points
- Quarterfinals: 3 points
- Semifinals: 4 points
- Finals: 5 points
- 3rd/4th Place: 4 points

**16-player tournaments (29 points max):**
- Round of 16: 1 point
- Quarterfinals: 2 points
- Semifinals: 3 points
- Finals: 4 points
- 3rd/4th Place: 3 points', 0),

('What happens when a tournament locks?', 'Tournaments lock at approximately the start time of the tournament; from that time on, all brackets are final and cannot be changed.', 1),

('What''s the difference between public and private brackets?', 'I get it - maybe you don''t want your friend to know that you think they''re going to lose in the first round.

Or maybe you''d like to have one public bracket and one private one where you predict you''ll be the one to win the championship.

Or maybe you''d just prefer to keep things anonymous and off the leaderboard.

No matter why, that''s the reason private exists - they are visible only to you and do not appear on the public leaderboard. You can toggle this back and forth at any time on the bracket page, including after creation.', 2),

('How are ties broken on the leaderboard?', 'If multiple brackets end up tied with the same score, ties are broken in this order:

1. Correctly predicted the champion (yes beats no)
2. For the championship match, who predicted the best-of-7 more accurately? Uses sum of differences - lower is better.
3. Total number of correct predictions (more is better)', 3),

('Can I create multiple brackets for the same tournament?', 'Yes, you can create as many brackets per tournament as you''d like.', 4),

('Can I edit my bracket after submitting?', 'Yes, you can edit your bracket predictions at any time before the tournament is locked. Once locked, all brackets become final.', 5);
