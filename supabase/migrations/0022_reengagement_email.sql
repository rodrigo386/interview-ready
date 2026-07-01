-- Migration 0022: re-engagement email flag
-- One-off nudge sent to dormant free users (signed up, never generated a prep).
-- Triggered from an /admin button; this column marks who's already been nudged
-- so repeated clicks don't re-spam. Server-managed (admin client only).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reengagement_email_sent_at timestamptz;
