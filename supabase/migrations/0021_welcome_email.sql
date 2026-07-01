-- Migration 0021: welcome email flag
-- One-time welcome/nudge email on first dashboard load. This column marks that
-- the email was sent, so it goes out at most once per user. Server-managed:
-- written only via the admin client (no UPDATE grant for `authenticated`), read
-- by the user's own dashboard SELECT.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
