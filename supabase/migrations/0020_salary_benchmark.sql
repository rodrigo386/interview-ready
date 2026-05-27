-- Migration 0020: Salary benchmark per prep
-- Adds salary range estimation (min/median/max in BRL + seniority + region)
-- as a 4th card on the prep Overview screen. Generated alongside company_intel
-- in the AI pipeline (Stage Salary, after Stage A / company research).
--
-- Pattern mirrors company_intel exactly:
--   - status enum: pending → researching → complete | failed | skipped
--   - JSONB payload validated by Zod (salaryBenchmarkSchema) at read time
--   - error column stores truncated stack/message for /admin debugging

ALTER TABLE public.prep_sessions
  ADD COLUMN IF NOT EXISTS salary_benchmark JSONB,
  ADD COLUMN IF NOT EXISTS salary_benchmark_status TEXT
    CHECK (salary_benchmark_status IN ('pending','researching','complete','failed','skipped')),
  ADD COLUMN IF NOT EXISTS salary_benchmark_error TEXT;
