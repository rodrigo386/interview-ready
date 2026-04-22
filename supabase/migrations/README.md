# Migrations

Applied manually via Supabase Dashboard → SQL Editor after each merge to `main`.

| # | File | Applied on |
|---|---|---|
| 0001 | `0001_initial.sql` | 2026-04-20 |
| 0002 | `0002_prep_sessions.sql` | 2026-04-21 |
| 0004 | `0004_ats_analysis.sql` | 2026-04-21 |
| 0005 | `0005_cvs.sql` | 2026-04-22 |
| 0006 | `0006_company_intel.sql` | pending |

## 0005 deploy steps

1. Run `0005_cvs.sql` in SQL Editor.
2. In Supabase Dashboard → Storage, create a new **private** bucket named `cvs`.
3. Run `0005_cvs_storage_policies.sql` in SQL Editor.
4. Verify: upload a CV on the live app, check `cvs` table has a row and the file is visible in the bucket under `{user_id}/{cv_id}.{ext}`.

## 0006 deploy steps

1. Run `0006_company_intel.sql` in Supabase SQL Editor.
2. Verify: create a prep, watch `company_intel_status` on `prep_sessions` transition `researching → complete` (or `skipped`).
