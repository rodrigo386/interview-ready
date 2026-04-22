ALTER TABLE public.prep_sessions
  ADD COLUMN company_intel JSONB,
  ADD COLUMN company_intel_status TEXT
    CHECK (company_intel_status IN ('pending','researching','complete','failed','skipped')),
  ADD COLUMN company_intel_error TEXT;
