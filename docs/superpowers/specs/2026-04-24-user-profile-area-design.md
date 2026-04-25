# User profile area — design spec

**Date:** 2026-04-24
**Status:** draft
**Author:** brainstorming session with Claude

## 1. Goal

Give every logged-in user a self-service profile area where they can:

1. Manage their avatar (upload custom photo or fall back to Gravatar).
2. Edit name and language preference.
3. See their tier + current usage, change their password, and delete their account.
4. Manage every CV tied to their account — both the ones they uploaded and the ones the AI has rewritten inside a prep session.

The feature lives at `/profile`, reachable from an avatar dropdown in the dashboard header.

## 2. Scope (confirmed)

- **C. Conta completa** — avatar + name + language + tier/usage readout + change password + delete account + unified CV management.
- **A. Lista unificada** — uploaded CVs and AI-rewritten CVs appear side by side, tagged by origin.
- **A. Avatar dropdown** in the header — click avatar → menu with `Meu perfil`, `Sair`.
- **B. Tabs internas** realizadas como rotas filhas (`/profile`, `/profile/cvs`, `/profile/account`) com layout compartilhado.
- **A. Bucket `avatars` público** + `profiles.avatar_url` column; cache-bust via `?v={updated_at}`.
- **A + D.** Upload mínimo (JPG/PNG/WebP ≤ 2MB, sem crop) com Gravatar fallback.

## 3. Non-goals (MVP)

- Cropping / resizing avatars server-side.
- Paid tier upgrade flow — tier is read-only; "Gerenciar assinatura" is out of scope.
- Renaming AI-generated CVs (they are derived from `company_name + job_title`).
- Soft-delete / recovery for accounts. Delete is hard cascade via `auth.users` FK.
- Promoting AI-rewritten CVs to standalone entities in the `cvs` table.

## 4. Architecture

### 4.1 Route structure

```
src/app/profile/
  layout.tsx           server: auth + fetch profile once + <ProfileShellProvider>
  page.tsx             aba "Perfil"       (foto, nome, idioma)
  cvs/page.tsx         aba "CVs"          (lista unificada)
  account/page.tsx     aba "Conta"        (tier/uso, senha, excluir)
  actions.ts           server actions (listed in §6)
```

To avoid duplicating the authenticated header, move the current
`src/app/dashboard/layout.tsx` up into a route group `src/app/(app)/layout.tsx`
and place both `dashboard/` and `profile/` under it. One auth gate, one header,
one theme toggle.

```
src/app/
  (app)/
    layout.tsx              ← auth + <AvatarMenu>; replaces dashboard/layout.tsx
    dashboard/page.tsx
    profile/...
```

### 4.2 Header dropdown

Replace the `<span>{user.email}</span>` in the header with `<AvatarMenu>`:
- Avatar thumbnail (32 px) resolved via `resolveAvatarUrl(profile)`.
- Chevron indicator on desktop.
- Click opens dropdown with: user email (muted), "Meu perfil" link → `/profile`, divider, "Sair" (uses existing `logout` server action).
- Closes on outside click, `Escape`, or menu item selection.

### 4.3 ProfileShellProvider + ProfileTabs

`ProfileShellProvider` is a client React context populated once by the layout with
`{ profile, email, resolvedAvatarUrl }`. Children read it without re-fetching on tab
switches. `ProfileTabs` uses `usePathname()` to highlight the active tab; keyboard
nav via native `<Link>` + `role="tablist"` attributes.

## 5. Data model

### 5.1 Migration `0008_profile_area.sql`

```sql
-- 1. Avatar on profile
ALTER TABLE public.profiles
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN avatar_updated_at TIMESTAMPTZ;

-- 2. Optional display name for uploaded CVs (file_name stays immutable)
ALTER TABLE public.cvs
  ADD COLUMN display_name TEXT;  -- NULL = usar file_name

-- 3. Storage policies for the new `avatars` bucket
-- (apply AFTER creating the public bucket via Supabase Dashboard)

CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars: upload own folder"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: update own folder"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: delete own folder"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 5.2 Storage layout

- Bucket: `avatars` (public, created manually via Supabase Dashboard — same
  operational pattern as `cvs`).
- Path: `{user_id}/avatar.{ext}` with `upsert: true` on re-upload.
- Public URL rendered by client is suffixed with `?v={avatar_updated_at_epoch}`
  to cache-bust CDN after a new upload.

### 5.3 Unified CV list query

```ts
const [uploaded, rewrites] = await Promise.all([
  supabase.from("cvs")
    .select("id, display_name, file_name, file_size_bytes, mime_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }),
  supabase.from("prep_sessions")
    .select("id, company_name, job_title, cv_rewrite_status, updated_at")
    .eq("user_id", user.id)
    .eq("cv_rewrite_status", "complete")
    .order("updated_at", { ascending: false }),
]);

// mergeCvs(uploaded, rewrites) → UnifiedCv[] sorted desc by timestamp,
// tagged origin: "upload" | "ai".
```

### 5.4 `UnifiedCv` type

```ts
type UnifiedCv =
  | { origin: "upload"; id: string; displayName: string; fileName: string;
      sizeBytes: number; mimeType: string; createdAt: string }
  | { origin: "ai"; prepSessionId: string; companyName: string; jobTitle: string;
      updatedAt: string };
```

## 6. Server actions

File: `src/app/profile/actions.ts`. All follow the existing repo pattern: Zod
validates input, returns `{ ok: true, ... }` or `{ ok: false, error }`, then
`revalidatePath("/profile")` (or the child path) on success.

```ts
// Perfil
updateProfile({ full_name?: string, preferred_language?: 'en'|'pt-br'|'es' })
updateAvatarPath({ ext: 'jpg'|'png'|'webp' })   // called after client upload
removeAvatar()                                   // deletes storage object + NULLs column

// CVs
deleteUploadedCv({ cvId: string })
renameUploadedCv({ cvId: string, displayName: string })   // ≤ 80 chars, trimmed
deleteAiCvRewrite({ prepSessionId: string })
  // UPDATE prep_sessions SET cv_rewrite = NULL,
  //                          cv_rewrite_status = 'pending',
  //                          cv_rewrite_error = NULL
  // WHERE id = $1 AND user_id = uid

// Conta
changePassword({ currentPassword: string, newPassword: string })
  // 1. reauthenticate via supabase.auth.signInWithPassword(email, currentPassword)
  // 2. supabase.auth.updateUser({ password: newPassword })
deleteAccount({ confirmation: 'EXCLUIR' })
  // 1. Delete all objects under storage: cvs/{uid}/* and avatars/{uid}/*
  // 2. DELETE FROM auth.users WHERE id = uid   (cascades: profiles, cvs, prep_sessions)
  // 3. supabase.auth.signOut()
  // 4. redirect('/')
```

## 7. Avatar flow

1. `<AvatarEditor>` validates file in the browser: MIME ∈ {image/jpeg, image/png,
   image/webp} and size ≤ 2,097,152 bytes. Rejects early with inline error.
2. Client calls
   `supabase.storage.from('avatars').upload('{uid}/avatar.{ext}', file, { upsert: true, contentType })`.
3. On success, client invokes `updateAvatarPath({ ext })` server action → sets
   `profiles.avatar_url = '{uid}/avatar.{ext}'` and `avatar_updated_at = now()`.
4. Action returns; client calls `router.refresh()` so the header `<AvatarMenu>`
   re-reads the context via the layout fetch.

`resolveAvatarUrl(profile)`:

```ts
if (profile.avatar_url) {
  const { data } = supabase.storage.from('avatars').getPublicUrl(profile.avatar_url);
  const v = new Date(profile.avatar_updated_at ?? 0).getTime();
  return `${data.publicUrl}?v=${v}`;
}
return gravatarUrl(profile.email, 128);
```

`gravatarUrl(email, size)`:
```ts
// MD5 of trimmed, lowercased email
return `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?d=mp&s=${size}`;
```

## 8. Components (new)

```
src/components/profile/
  ProfileShellProvider.tsx     client context, invalidate on update
  ProfileTabs.tsx              client, 3 segments with usePathname()
  AvatarEditor.tsx             client, preview + file input + remove + Gravatar fallback preview
  ProfileForm.tsx              client, name + language, dirty-state aware
  CvList.tsx                   server, renders merged list
  CvRow.tsx                    client, origin-aware actions
  AccountSection.tsx           client, tier readout + change password + delete account
  ChangePasswordDialog.tsx     client, modal with current + new fields, strength hint
  DeleteAccountDialog.tsx      client, modal with "digite EXCLUIR" confirmation

src/components/ui/
  AvatarMenu.tsx               client, header dropdown
  Avatar.tsx                   universal, <img> with graceful onError fallback to Gravatar
```

Helpers in `src/lib/profile/`:

```
gravatar.ts          gravatarUrl(email, size) + md5 (use node:crypto createHash)
avatar-url.ts        resolveAvatarUrl(profile)
cv-merge.ts          mergeCvs(uploaded, rewrites): UnifiedCv[]
types.ts             UnifiedCv, ProfileShellData
```

`CvPicker` (existing, used by `/prep/new`) is **not** modified — it keeps pulling
from the `cvs` table only. AI rewrites never appear there.

## 9. UX details

- **Tabs** follow the visual language of `PrepStepper` (pill segments, brand
  accent on active). Mobile collapses labels to icons.
- **AvatarEditor** row: large circular avatar (96 px) on the left, two buttons
  (`Alterar foto`, `Remover foto`) on the right. Inline helper "JPG, PNG ou
  WebP até 2MB". If no custom avatar, caption reads "Usando seu Gravatar" with
  a small link to Gravatar.com.
- **CvList** renders an empty state when user has zero CVs: "Você ainda não
  tem CVs" + link "Criar meu primeiro prep" → `/prep/new`.
- **CvRow**: file icon on the left, name in the middle (editable inline for
  `upload` origin only), origin chip on the right (`Original` neutral /
  `Reescrito pela IA` brand), actions menu (•••) with `Baixar`, `Renomear`
  (upload only), `Excluir`.
- **DeleteAccountDialog** copy: "Essa ação é permanente. Todos os seus preps,
  CVs e dados serão excluídos imediatamente. Digite EXCLUIR para confirmar."

## 10. Error handling

- Upload > 2MB or invalid MIME → client-side validation, no server call.
- Storage upload failure → show inline error, keep `avatar_url` unchanged.
  Retry manual via button. No partial DB state.
- Delete account is not transactional end-to-end. If storage cleanup succeeds
  but DB delete fails, user sees error and can retry — they may be left with
  orphan storage objects which the next successful delete picks up. Acceptable
  for MVP given the rarity.
- `changePassword` with wrong current password → Supabase returns auth error
  which we surface inline; no enumeration risk since user is already authed.

## 11. Testing

Follow the repo convention (Vitest `environment: "node"` default, jsdom via
`environmentMatchGlobs` for `src/components/**/*.test.{ts,tsx}`).

**Unit tests (`src/lib/profile/`):**
- `gravatar.test.ts` — MD5 for known emails, trim + lowercase, `d=mp&s=128`.
- `cv-merge.test.ts` — sort desc by timestamp, origin tagging, `display_name`
  fallback, filters non-`complete` rewrites.
- `avatar-url.test.ts` — `?v=` cache-bust, Gravatar fallback when null.

**Component tests (`src/components/profile/`):**
- `AvatarEditor` — rejects > 2MB, rejects invalid MIME, renders preview.
- `ProfileForm` — dirty state, disabled submit when pristine, payload shape.
- `CvRow` — origin chip, action availability matrix (rename only on upload).
- `DeleteAccountDialog` — submit disabled until input === `EXCLUIR`.

**Server action tests (`src/app/profile/actions.test.ts`):**
- Zod rejection for invalid payloads.
- Mock Supabase client — RLS is enforced by the DB, but we verify actions only
  call `.eq('user_id', authedUser.id)` where relevant.
- Error path returns `{ ok: false }` on DB failure.

**E2E (optional scaffold, `tests/e2e/profile.spec.ts`):**
- Login → avatar dropdown → `/profile` → change language → reload → persists.

**Out of scope for automated tests:**
- Real upload to Supabase storage (slow + requires bucket).
- Live Gravatar HTTP call (we assert the generated URL shape).
- `deleteAccount` E2E (destructive + environment-sensitive — manual QA only).

## 12. Rollout plan (summary — full plan comes from writing-plans next)

1. Migration `0008_profile_area.sql` + create `avatars` bucket (public) via
   Supabase Dashboard.
2. Add `avatar_url` + `avatar_updated_at` to the `profiles` select in the
   server layout so the header can render the avatar on every authenticated
   page before the profile page itself ships.
3. Extract dashboard header into `src/app/(app)/layout.tsx`; move `dashboard/`
   and create `profile/` underneath.
4. Ship `<AvatarMenu>` in the header (shows Gravatar until user uploads).
5. Build `/profile` (Perfil tab) with avatar upload + name/language form.
6. Build `/profile/cvs` with unified list + row actions.
7. Build `/profile/account` with tier readout, change password, delete account.
8. Tests (unit + component + action). E2E optional.

## 13. Known edges / decisions deferred

- No server-side avatar processing (resize/crop) → images may be huge; relying
  on browsers to scale 96–128 px renders. Acceptable at current scale.
- No rate limiting on `changePassword`. Supabase has platform-level protection
  but we are not adding app-level throttling in the MVP.
- Tier / usage remains read-only until the billing sub-project lands; the UI
  leaves a placeholder `<Button variant="ghost" disabled>Gerenciar
  assinatura</Button>` so we can wire it later without a layout shift.
- `deleteAccount` leaves no audit trail. If compliance requires one, switch to
  a `deleted_accounts` append-only log in a follow-up.
