# User Profile Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/profile` with avatar dropdown, tabs (Perfil / CVs / Conta), unified CV management (uploads + AI rewrites), Gravatar fallback, change password, and account deletion.

**Architecture:** New route group `(app)/` shares an authenticated header across `dashboard/` and `profile/`. Profile tabs are sibling routes (`/profile`, `/profile/cvs`, `/profile/account`) under a shared layout. Avatar storage uses a new public Supabase bucket `avatars`. CV list is server-merged from `cvs` table + `prep_sessions.cv_rewrite` JSONB.

**Tech Stack:** Next.js 15.5 (App Router, RSC), React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + Auth + Storage), Vitest (`environment: "node"` default, jsdom for components via `environmentMatchGlobs`), `@testing-library/react`, `node:crypto` for MD5.

**Spec:** `docs/superpowers/specs/2026-04-24-user-profile-area-design.md`

---

## File Structure

```
supabase/migrations/
  0008_profile_area.sql                ← migration: avatars + cvs.display_name + storage policies

src/lib/profile/
  types.ts                             ← UnifiedCv, ProfileShellData
  gravatar.ts                          ← gravatarUrl(email, size) — Node MD5
  avatar-url.ts                        ← resolveAvatarUrl(profile, supabase)
  cv-merge.ts                          ← mergeCvs(uploaded, rewrites)
  *.test.ts                            ← unit tests (Vitest, node env)

src/app/(app)/
  layout.tsx                           ← MOVED from dashboard/layout.tsx, adds AvatarMenu
  dashboard/
    page.tsx                           ← MOVED from src/app/dashboard/page.tsx (no change)
    actions.ts                         ← MOVED (logout)
  profile/
    layout.tsx                         ← server: auth + fetch profile + Provider + Tabs
    page.tsx                           ← Perfil tab
    cvs/page.tsx                       ← CVs tab
    account/page.tsx                   ← Conta tab
    actions.ts                         ← server actions (perfil + cvs + conta)

src/components/profile/
  ProfileShellProvider.tsx
  ProfileTabs.tsx
  AvatarEditor.tsx
  ProfileForm.tsx
  CvList.tsx                           ← server component (uses server Supabase)
  CvRow.tsx                            ← client (action menu)
  AccountSection.tsx
  ChangePasswordDialog.tsx
  DeleteAccountDialog.tsx
  *.test.tsx                           ← component tests (Vitest, jsdom)

src/components/ui/
  Avatar.tsx                           ← <img> + onError → Gravatar fallback
  AvatarMenu.tsx                       ← header dropdown (Radix-free, native menu)
  Dropdown.tsx                         ← (only if no existing dropdown — TBD-free: see Task 5)
```

---

## Task 1: Migration + storage bucket setup

**Files:**
- Create: `supabase/migrations/0008_profile_area.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0008_profile_area.sql
-- Adds avatar columns to profiles, display_name to cvs, and storage policies
-- for the new public `avatars` bucket. The bucket itself MUST be created
-- manually in the Supabase Dashboard (Storage → New bucket → Public).

ALTER TABLE public.profiles
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN avatar_updated_at TIMESTAMPTZ;

ALTER TABLE public.cvs
  ADD COLUMN display_name TEXT;

-- Storage policies for `avatars` bucket
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: update own folder"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: delete own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run via the Supabase MCP server in the Claude session, OR commit and let the
preview pipeline pick it up. Manual command if running locally:

```bash
# Local Supabase (dev only)
supabase db push
```

For prod: apply via `mcp__claude_ai_Supabase__apply_migration` or paste into SQL editor.

- [ ] **Step 3: Create the public `avatars` bucket**

This is a manual one-time step in the Supabase Dashboard:
1. Storage → Create bucket → Name: `avatars`, Public: ON
2. Verify bucket exists: it must appear in `storage.buckets` with `public = true`

(Tip: ask the user to confirm the bucket exists before proceeding to Task 5.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_profile_area.sql
git commit -m "feat(db): add avatar columns + cvs.display_name + avatars bucket policies"
```

---

## Task 2: `gravatar.ts` helper (TDD)

**Files:**
- Create: `src/lib/profile/gravatar.ts`
- Test: `src/lib/profile/gravatar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/profile/gravatar.test.ts
import { describe, expect, it } from "vitest";
import { gravatarUrl } from "./gravatar";

describe("gravatarUrl", () => {
  it("computa MD5 do email lowercase + trim", () => {
    // md5("rgoalves@gmail.com") = f4c4a4391bf6714a053ae35ef1c475ce
    expect(gravatarUrl("  RGoalves@Gmail.com  ", 128)).toBe(
      "https://www.gravatar.com/avatar/f4c4a4391bf6714a053ae35ef1c475ce?d=mp&s=128",
    );
  });

  it("usa default size=128 quando não informado", () => {
    expect(gravatarUrl("foo@bar.com")).toMatch(/\?d=mp&s=128$/);
  });

  it("aceita size custom", () => {
    expect(gravatarUrl("foo@bar.com", 256)).toMatch(/\?d=mp&s=256$/);
  });

  it("sempre lowercase no hash mesmo se input já vier minúsculo", () => {
    expect(gravatarUrl("foo@bar.com", 64)).toBe(gravatarUrl("FOO@BAR.COM", 64));
  });
});
```

(MD5 hash above was computed via `node -e "console.log(require('crypto').createHash('md5').update('rgoalves@gmail.com').digest('hex'))"`.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/profile/gravatar.test.ts
```

Expected: FAIL — `Cannot find module './gravatar'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/profile/gravatar.ts
import { createHash } from "node:crypto";

export function gravatarUrl(email: string, size = 128): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash("md5").update(normalized).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=${size}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/profile/gravatar.test.ts
```

Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile/gravatar.ts src/lib/profile/gravatar.test.ts
git commit -m "feat(profile): add gravatarUrl helper"
```

---

## Task 3: `cv-merge.ts` helper + types (TDD)

**Files:**
- Create: `src/lib/profile/types.ts`
- Create: `src/lib/profile/cv-merge.ts`
- Test: `src/lib/profile/cv-merge.test.ts`

- [ ] **Step 1: Define shared types**

```ts
// src/lib/profile/types.ts
export type UploadedCvRow = {
  id: string;
  file_name: string;
  display_name: string | null;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type AiRewriteRow = {
  id: string;            // prep_session id
  company_name: string;
  job_title: string;
  cv_rewrite_status: string;
  updated_at: string;
};

export type UnifiedCv =
  | {
      origin: "upload";
      id: string;
      displayName: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      createdAt: string;
    }
  | {
      origin: "ai";
      prepSessionId: string;
      companyName: string;
      jobTitle: string;
      updatedAt: string;
    };

export type ProfileShellData = {
  id: string;
  email: string;
  fullName: string | null;
  preferredLanguage: "en" | "pt-br" | "es";
  tier: "free" | "pro" | "team";
  prepsUsedThisMonth: number;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  resolvedAvatarUrl: string;
};
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/profile/cv-merge.test.ts
import { describe, expect, it } from "vitest";
import { mergeCvs } from "./cv-merge";

describe("mergeCvs", () => {
  it("retorna lista vazia quando ambas inputs vazias", () => {
    expect(mergeCvs([], [])).toEqual([]);
  });

  it("usa display_name quando presente, senão file_name", () => {
    const result = mergeCvs(
      [
        {
          id: "a",
          file_name: "cv.pdf",
          display_name: "Meu CV principal",
          file_size_bytes: 1024,
          mime_type: "application/pdf",
          created_at: "2026-04-20T10:00:00Z",
        },
        {
          id: "b",
          file_name: "old.pdf",
          display_name: null,
          file_size_bytes: 2048,
          mime_type: "application/pdf",
          created_at: "2026-04-19T10:00:00Z",
        },
      ],
      [],
    );
    expect(result[0]).toMatchObject({ origin: "upload", displayName: "Meu CV principal" });
    expect(result[1]).toMatchObject({ origin: "upload", displayName: "old.pdf" });
  });

  it("filtra rewrites com cv_rewrite_status !== 'complete'", () => {
    const result = mergeCvs(
      [],
      [
        {
          id: "p1",
          company_name: "Acme",
          job_title: "Eng",
          cv_rewrite_status: "complete",
          updated_at: "2026-04-22T10:00:00Z",
        },
        {
          id: "p2",
          company_name: "Beta",
          job_title: "PM",
          cv_rewrite_status: "generating",
          updated_at: "2026-04-23T10:00:00Z",
        },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ origin: "ai", prepSessionId: "p1" });
  });

  it("ordena tudo descendente por timestamp (createdAt para upload, updatedAt para ai)", () => {
    const result = mergeCvs(
      [
        {
          id: "u1",
          file_name: "a.pdf",
          display_name: null,
          file_size_bytes: 1,
          mime_type: "application/pdf",
          created_at: "2026-04-20T10:00:00Z",
        },
      ],
      [
        {
          id: "p1",
          company_name: "Acme",
          job_title: "Eng",
          cv_rewrite_status: "complete",
          updated_at: "2026-04-22T10:00:00Z",
        },
      ],
    );
    expect(result[0].origin).toBe("ai");
    expect(result[1].origin).toBe("upload");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test src/lib/profile/cv-merge.test.ts
```

Expected: FAIL — `Cannot find module './cv-merge'`.

- [ ] **Step 4: Implement**

```ts
// src/lib/profile/cv-merge.ts
import type { AiRewriteRow, UnifiedCv, UploadedCvRow } from "./types";

export function mergeCvs(
  uploaded: UploadedCvRow[],
  rewrites: AiRewriteRow[],
): UnifiedCv[] {
  const fromUploads: UnifiedCv[] = uploaded.map((row) => ({
    origin: "upload",
    id: row.id,
    displayName: row.display_name?.trim() || row.file_name,
    fileName: row.file_name,
    sizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));

  const fromRewrites: UnifiedCv[] = rewrites
    .filter((row) => row.cv_rewrite_status === "complete")
    .map((row) => ({
      origin: "ai",
      prepSessionId: row.id,
      companyName: row.company_name,
      jobTitle: row.job_title,
      updatedAt: row.updated_at,
    }));

  const all = [...fromUploads, ...fromRewrites];
  return all.sort((a, b) => {
    const ta = a.origin === "upload" ? a.createdAt : a.updatedAt;
    const tb = b.origin === "upload" ? b.createdAt : b.updatedAt;
    return tb.localeCompare(ta);
  });
}
```

- [ ] **Step 5: Run test, verify pass, commit**

```bash
pnpm test src/lib/profile/cv-merge.test.ts
git add src/lib/profile/types.ts src/lib/profile/cv-merge.ts src/lib/profile/cv-merge.test.ts
git commit -m "feat(profile): add UnifiedCv types + mergeCvs helper"
```

---

## Task 4: `avatar-url.ts` helper (TDD)

**Files:**
- Create: `src/lib/profile/avatar-url.ts`
- Test: `src/lib/profile/avatar-url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/profile/avatar-url.test.ts
import { describe, expect, it, vi } from "vitest";
import { resolveAvatarUrl } from "./avatar-url";

function fakeStorage(publicUrl: string) {
  return {
    storage: {
      from: (_bucket: string) => ({
        getPublicUrl: (_path: string) => ({ data: { publicUrl } }),
      }),
    },
  } as Parameters<typeof resolveAvatarUrl>[1];
}

describe("resolveAvatarUrl", () => {
  it("retorna Gravatar quando avatarPath é null", () => {
    const url = resolveAvatarUrl(
      { email: "foo@bar.com", avatarPath: null, avatarUpdatedAt: null },
      fakeStorage(""),
    );
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\//);
    expect(url).toMatch(/\?d=mp&s=128$/);
  });

  it("retorna URL pública com cache-bust quando avatarPath presente", () => {
    const url = resolveAvatarUrl(
      {
        email: "foo@bar.com",
        avatarPath: "uid-abc/avatar.jpg",
        avatarUpdatedAt: "2026-04-24T12:00:00Z",
      },
      fakeStorage("https://cdn.example/uid-abc/avatar.jpg"),
    );
    const expectedV = new Date("2026-04-24T12:00:00Z").getTime();
    expect(url).toBe(`https://cdn.example/uid-abc/avatar.jpg?v=${expectedV}`);
  });

  it("usa v=0 quando avatarUpdatedAt é null mas path existe", () => {
    const url = resolveAvatarUrl(
      { email: "foo@bar.com", avatarPath: "uid/avatar.png", avatarUpdatedAt: null },
      fakeStorage("https://cdn.example/uid/avatar.png"),
    );
    expect(url).toBe("https://cdn.example/uid/avatar.png?v=0");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
pnpm test src/lib/profile/avatar-url.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/profile/avatar-url.ts
import { gravatarUrl } from "./gravatar";

type StorageLike = {
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

export function resolveAvatarUrl(
  profile: { email: string; avatarPath: string | null; avatarUpdatedAt: string | null },
  supabase: StorageLike,
): string {
  if (!profile.avatarPath) {
    return gravatarUrl(profile.email, 128);
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(profile.avatarPath);
  const v = profile.avatarUpdatedAt ? new Date(profile.avatarUpdatedAt).getTime() : 0;
  return `${data.publicUrl}?v=${v}`;
}
```

- [ ] **Step 4: Run test, verify pass, commit**

```bash
pnpm test src/lib/profile/avatar-url.test.ts
git add src/lib/profile/avatar-url.ts src/lib/profile/avatar-url.test.ts
git commit -m "feat(profile): add resolveAvatarUrl helper"
```

---

## Task 5: Move dashboard layout into `(app)/` route group

**Files:**
- Move: `src/app/dashboard/layout.tsx` → `src/app/(app)/layout.tsx`
- Move: `src/app/dashboard/page.tsx` → `src/app/(app)/dashboard/page.tsx`
- Move: `src/app/dashboard/actions.ts` → `src/app/(app)/dashboard/actions.ts`

The route group `(app)` does not appear in the URL — `/dashboard` keeps the same path. This consolidates the authenticated header.

- [ ] **Step 1: Create new directory + move files**

```bash
mkdir -p "src/app/(app)/dashboard"
git mv src/app/dashboard/page.tsx "src/app/(app)/dashboard/page.tsx"
git mv src/app/dashboard/actions.ts "src/app/(app)/dashboard/actions.ts"
git mv src/app/dashboard/layout.tsx "src/app/(app)/layout.tsx"
rmdir src/app/dashboard
```

- [ ] **Step 2: Fix the import in `actions.ts`** (path alias `@/` is unaffected, but verify)

Open `src/app/(app)/dashboard/actions.ts` — should be unchanged content. Open `src/app/(app)/layout.tsx` — change the `import { logout } from "./actions";` line to `import { logout } from "./dashboard/actions";` since logout has moved into the dashboard subfolder.

```tsx
// src/app/(app)/layout.tsx — modify the import
import { logout } from "./dashboard/actions";
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS — no missing imports.

- [ ] **Step 4: Run dev server + smoke check**

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard` (logged in) — header still renders, logout still works. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(app): move dashboard into (app) route group for shared header"
```

---

## Task 6: `Avatar` component (TDD)

**Files:**
- Create: `src/components/ui/Avatar.tsx`
- Test: `src/components/ui/Avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/Avatar.test.tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("<Avatar />", () => {
  it("renderiza img com src e alt", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="Foto de Foo" size={48} />,
    );
    const img = getByRole("img") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/a.jpg");
    expect(img.alt).toBe("Foto de Foo");
  });

  it("aplica size em width e height", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="x" size={96} />,
    );
    const img = getByRole("img") as HTMLImageElement;
    expect(img.width).toBe(96);
    expect(img.height).toBe(96);
  });

  it("é circular (rounded-full)", () => {
    const { getByRole } = render(
      <Avatar src="https://example.com/a.jpg" alt="x" size={48} />,
    );
    expect(getByRole("img").className).toMatch(/rounded-full/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/components/ui/Avatar.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/Avatar.tsx
export function Avatar({
  src,
  alt,
  size,
  className = "",
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL is external (Gravatar / Supabase CDN), Image not needed
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-line ${className}`}
    />
  );
}
```

- [ ] **Step 4: Run, verify pass, commit**

```bash
pnpm test src/components/ui/Avatar.test.tsx
git add src/components/ui/Avatar.tsx src/components/ui/Avatar.test.tsx
git commit -m "feat(ui): add Avatar component"
```

---

## Task 7: `AvatarMenu` dropdown in header (TDD)

**Files:**
- Create: `src/components/ui/AvatarMenu.tsx`
- Test: `src/components/ui/AvatarMenu.test.tsx`
- Modify: `src/app/(app)/layout.tsx` (replace `<span>{user.email}</span>` block)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/AvatarMenu.test.tsx
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AvatarMenu } from "./AvatarMenu";

const baseProps = {
  email: "foo@bar.com",
  avatarUrl: "https://example.com/a.jpg",
  logoutAction: async () => {},
};

describe("<AvatarMenu />", () => {
  it("começa fechado (menu não no DOM)", () => {
    const { queryByRole } = render(<AvatarMenu {...baseProps} />);
    expect(queryByRole("menu")).toBeNull();
  });

  it("abre menu ao clicar no botão", () => {
    const { getByRole, getByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    expect(getByText("Meu perfil")).toBeInTheDocument();
    expect(getByText("Sair")).toBeInTheDocument();
  });

  it("mostra email no menu aberto", () => {
    const { getByRole, getByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    expect(getByText("foo@bar.com")).toBeInTheDocument();
  });

  it("fecha ao pressionar Escape", () => {
    const { getByRole, queryByText } = render(<AvatarMenu {...baseProps} />);
    fireEvent.click(getByRole("button", { name: /menu do usuário/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByText("Meu perfil")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/components/ui/AvatarMenu.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/AvatarMenu.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

export function AvatarMenu({
  email,
  avatarUrl,
  logoutAction,
}: {
  email: string;
  avatarUrl: string;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full ring-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <Avatar src={avatarUrl} alt="Sua foto de perfil" size={32} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border bg-bg shadow-prep"
        >
          <p className="truncate px-3 py-2 text-xs text-text-tertiary">{email}</p>
          <hr className="border-border" />
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-text-primary hover:bg-line"
          >
            Meu perfil
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-line"
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm test src/components/ui/AvatarMenu.test.tsx
```

- [ ] **Step 5: Wire AvatarMenu into the (app) layout**

Open `src/app/(app)/layout.tsx`. Replace this block:

```tsx
<span className="hidden text-sm text-text-secondary sm:inline">
  {user.email}
</span>
<ThemeToggle />
<form action={logout}>
  <Button variant="ghost" type="submit">
    Sair
  </Button>
</form>
```

With:

```tsx
<ThemeToggle />
<AvatarMenu
  email={user.email!}
  avatarUrl={resolvedAvatarUrl}
  logoutAction={logout}
/>
```

And at the top of the file:

```tsx
import { AvatarMenu } from "@/components/ui/AvatarMenu";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
```

Inside the component, after fetching `user`, fetch the profile and resolve the avatar URL:

```tsx
const supabase = await createClient();
const { data } = await supabase.auth.getUser();
user = data.user;

let resolvedAvatarUrl = "";
if (user) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, avatar_updated_at")
    .eq("id", user.id)
    .single();
  resolvedAvatarUrl = resolveAvatarUrl(
    {
      email: user.email!,
      avatarPath: profile?.avatar_url ?? null,
      avatarUpdatedAt: profile?.avatar_updated_at ?? null,
    },
    supabase,
  );
}
```

Drop the unused `Button` import if it's no longer referenced.

- [ ] **Step 6: Smoke test + commit**

```bash
pnpm typecheck
pnpm dev   # visit /dashboard, verify Gravatar avatar appears + dropdown works
```

```bash
git add src/components/ui/AvatarMenu.tsx src/components/ui/AvatarMenu.test.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(ui): replace email/logout with AvatarMenu dropdown in header"
```

---

## Task 8: Profile shell — layout + provider + tabs

**Files:**
- Create: `src/app/(app)/profile/layout.tsx`
- Create: `src/components/profile/ProfileShellProvider.tsx`
- Create: `src/components/profile/ProfileTabs.tsx`
- Test: `src/components/profile/ProfileTabs.test.tsx`

- [ ] **Step 1: Write failing test for ProfileTabs**

```tsx
// src/components/profile/ProfileTabs.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProfileTabs } from "./ProfileTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/cvs",
}));

describe("<ProfileTabs />", () => {
  it("renderiza 3 tabs com aria-current na ativa", () => {
    const { getAllByRole } = render(<ProfileTabs />);
    const tabs = getAllByRole("link");
    expect(tabs).toHaveLength(3);
    const active = tabs.find((t) => t.getAttribute("aria-current") === "page");
    expect(active?.textContent).toBe("CVs");
  });

  it("links apontam pras rotas corretas", () => {
    const { getAllByRole } = render(<ProfileTabs />);
    const hrefs = getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/profile", "/profile/cvs", "/profile/account"]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test src/components/profile/ProfileTabs.test.tsx
```

- [ ] **Step 3: Implement ProfileTabs**

```tsx
// src/components/profile/ProfileTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile", label: "Perfil" },
  { href: "/profile/cvs", label: "CVs" },
  { href: "/profile/account", label: "Conta" },
] as const;

export function ProfileTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do perfil" className="border-b border-border">
      <ul role="tablist" className="flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-brand-600 text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Implement ProfileShellProvider**

```tsx
// src/components/profile/ProfileShellProvider.tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProfileShellData } from "@/lib/profile/types";

const Ctx = createContext<ProfileShellData | null>(null);

export function ProfileShellProvider({
  data,
  children,
}: {
  data: ProfileShellData;
  children: ReactNode;
}) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useProfileShell(): ProfileShellData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfileShell must be used inside ProfileShellProvider");
  return v;
}
```

- [ ] **Step 5: Implement profile layout**

```tsx
// src/app/(app)/profile/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { ProfileShellProvider } from "@/components/profile/ProfileShellProvider";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import type { ProfileShellData } from "@/lib/profile/types";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, preferred_language, tier, preps_used_this_month, avatar_url, avatar_updated_at",
    )
    .eq("id", auth.user.id)
    .single();

  if (!profile) redirect("/login");

  const data: ProfileShellData = {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    preferredLanguage: profile.preferred_language,
    tier: profile.tier,
    prepsUsedThisMonth: profile.preps_used_this_month,
    avatarPath: profile.avatar_url,
    avatarUpdatedAt: profile.avatar_updated_at,
    resolvedAvatarUrl: resolveAvatarUrl(
      {
        email: profile.email,
        avatarPath: profile.avatar_url,
        avatarUpdatedAt: profile.avatar_updated_at,
      },
      supabase,
    ),
  };

  return (
    <ProfileShellProvider data={data}>
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Meu perfil</h1>
        <ProfileTabs />
        <div className="pt-2">{children}</div>
      </div>
    </ProfileShellProvider>
  );
}
```

- [ ] **Step 6: Run tests + typecheck + commit**

```bash
pnpm test src/components/profile/ProfileTabs.test.tsx
pnpm typecheck
git add src/components/profile/ProfileTabs.tsx \
        src/components/profile/ProfileTabs.test.tsx \
        src/components/profile/ProfileShellProvider.tsx \
        "src/app/(app)/profile/layout.tsx"
git commit -m "feat(profile): add layout + ProfileShellProvider + ProfileTabs"
```

---

## Task 9: Perfil tab — actions + ProfileForm + AvatarEditor + page

**Files:**
- Create: `src/app/(app)/profile/actions.ts`
- Create: `src/components/profile/ProfileForm.tsx`
- Create: `src/components/profile/AvatarEditor.tsx`
- Create: `src/app/(app)/profile/page.tsx`
- Test: `src/components/profile/ProfileForm.test.tsx`
- Test: `src/components/profile/AvatarEditor.test.tsx`

- [ ] **Step 1: Implement initial server actions skeleton**

```ts
// src/app/(app)/profile/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  preferred_language: z.enum(["en", "pt-br", "es"]).optional(),
});

const updateAvatarPathSchema = z.object({
  ext: z.enum(["jpg", "png", "webp"]),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: z.infer<typeof updateProfileSchema>): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const patch: Record<string, unknown> = {};
  if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name || null;
  if (parsed.data.preferred_language !== undefined) patch.preferred_language = parsed.data.preferred_language;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateAvatarPath(input: z.infer<typeof updateAvatarPathSchema>): Promise<ActionResult> {
  const parsed = updateAvatarPathSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Extensão inválida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const path = `${auth.user.id}/avatar.${parsed.data.ext}`;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path, avatar_updated_at: new Date().toISOString() })
    .eq("id", auth.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const uid = auth.user.id;
  // Try to remove all avatar variants from storage; ignore not-found errors.
  await supabase.storage.from("avatars").remove([
    `${uid}/avatar.jpg`,
    `${uid}/avatar.png`,
    `${uid}/avatar.webp`,
  ]);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null, avatar_updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 2: Write failing test for ProfileForm**

```tsx
// src/components/profile/ProfileForm.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ProfileForm } from "./ProfileForm";

const baseProps = {
  initialFullName: "João",
  initialLanguage: "pt-br" as const,
  action: vi.fn(async () => ({ ok: true as const })),
};

describe("<ProfileForm />", () => {
  it("submit button começa desabilitado (pristine)", () => {
    const { getByRole } = render(<ProfileForm {...baseProps} />);
    expect((getByRole("button", { name: /salvar/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("habilita submit quando user muda o nome", () => {
    const { getByLabelText, getByRole } = render(<ProfileForm {...baseProps} />);
    fireEvent.change(getByLabelText(/nome/i), { target: { value: "João Silva" } });
    expect((getByRole("button", { name: /salvar/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("chama action com o payload correto", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    const { getByLabelText, getByRole } = render(<ProfileForm {...baseProps} action={action} />);
    fireEvent.change(getByLabelText(/nome/i), { target: { value: "Maria" } });
    fireEvent.change(getByLabelText(/idioma/i), { target: { value: "en" } });
    fireEvent.click(getByRole("button", { name: /salvar/i }));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({ full_name: "Maria", preferred_language: "en" }),
    );
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement ProfileForm**

```tsx
// src/components/profile/ProfileForm.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

type Lang = "en" | "pt-br" | "es";

export function ProfileForm({
  initialFullName,
  initialLanguage,
  action,
}: {
  initialFullName: string | null;
  initialLanguage: Lang;
  action: (input: { full_name?: string; preferred_language?: Lang }) => Promise<ActionResult>;
}) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [language, setLanguage] = useState<Lang>(initialLanguage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = fullName !== (initialFullName ?? "") || language !== initialLanguage;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await action({ full_name: fullName.trim(), preferred_language: language });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm text-text-secondary">
          Nome completo
        </label>
        <input
          id="full_name"
          type="text"
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="language" className="mb-1 block text-sm text-text-secondary">
          Idioma preferido
        </label>
        <select
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="pt-br">Português (BR)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={!dirty || pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Write failing test for AvatarEditor**

```tsx
// src/components/profile/AvatarEditor.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AvatarEditor } from "./AvatarEditor";

const baseProps = {
  userId: "uid-1",
  currentUrl: "https://example.com/a.jpg",
  hasCustomAvatar: false,
  uploadFn: vi.fn(async () => undefined),                 // simulates supabase upload
  updatePathAction: vi.fn(async () => ({ ok: true as const })),
  removeAction: vi.fn(async () => ({ ok: true as const })),
};

describe("<AvatarEditor />", () => {
  it("rejeita arquivo > 2MB", async () => {
    const { getByLabelText, findByText } = render(<AvatarEditor {...baseProps} />);
    const file = new File([new Uint8Array(2_500_000)], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    expect(await findByText(/máximo de 2/i)).toBeInTheDocument();
    expect(baseProps.uploadFn).not.toHaveBeenCalled();
  });

  it("rejeita mime inválido", async () => {
    const { getByLabelText, findByText } = render(<AvatarEditor {...baseProps} />);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    expect(await findByText(/formato/i)).toBeInTheDocument();
  });

  it("chama uploadFn + updatePathAction quando arquivo válido", async () => {
    const uploadFn = vi.fn(async () => undefined);
    const updatePathAction = vi.fn(async () => ({ ok: true as const }));
    const { getByLabelText } = render(
      <AvatarEditor {...baseProps} uploadFn={uploadFn} updatePathAction={updatePathAction} />,
    );
    const file = new File(["x"], "ok.png", { type: "image/png" });
    fireEvent.change(getByLabelText(/alterar foto/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadFn).toHaveBeenCalled());
    await waitFor(() => expect(updatePathAction).toHaveBeenCalledWith({ ext: "png" }));
  });
});
```

- [ ] **Step 6: Implement AvatarEditor**

```tsx
// src/components/profile/AvatarEditor.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TO_EXT: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function AvatarEditor({
  userId,
  currentUrl,
  hasCustomAvatar,
  uploadFn,
  updatePathAction,
  removeAction,
}: {
  userId: string;
  currentUrl: string;
  hasCustomAvatar: boolean;
  uploadFn: (path: string, file: File) => Promise<unknown>;
  updatePathAction: (input: { ext: "jpg" | "png" | "webp" }) => Promise<ActionResult>;
  removeAction: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File) => {
    setError(null);
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      setError("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Arquivo grande demais. Máximo de 2MB.");
      return;
    }
    startTransition(async () => {
      const path = `${userId}/avatar.${ext}`;
      try {
        await uploadFn(path, file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha no upload.");
        return;
      }
      const result = await updatePathAction({ ext });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleRemove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar src={currentUrl} alt="Sua foto de perfil" size={96} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor="avatar-upload"
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-line"
          >
            Alterar foto
            <input
              id="avatar-upload"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </label>
          {hasCustomAvatar && (
            <Button variant="ghost" type="button" onClick={handleRemove} disabled={pending}>
              Remover foto
            </Button>
          )}
        </div>
        <p className="text-xs text-text-tertiary">
          JPG, PNG ou WebP até 2MB.{" "}
          {!hasCustomAvatar && "Sem foto custom, mostramos seu Gravatar."}
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement profile page (Perfil tab)**

```tsx
// src/app/(app)/profile/page.tsx
"use client";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useProfileShell } from "@/components/profile/ProfileShellProvider";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { removeAvatar, updateAvatarPath, updateProfile } from "./actions";

export default function ProfilePage() {
  const data = useProfileShell();
  const supabase = createBrowserClient();

  const uploadFn = async (path: string, file: File) => {
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Foto</h2>
        <AvatarEditor
          userId={data.id}
          currentUrl={data.resolvedAvatarUrl}
          hasCustomAvatar={Boolean(data.avatarPath)}
          uploadFn={uploadFn}
          updatePathAction={updateAvatarPath}
          removeAction={removeAvatar}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Identidade</h2>
        <ProfileForm
          initialFullName={data.fullName}
          initialLanguage={data.preferredLanguage}
          action={updateProfile}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Run all tests + typecheck + commit**

```bash
pnpm test src/components/profile/ProfileForm.test.tsx \
          src/components/profile/AvatarEditor.test.tsx
pnpm typecheck

git add "src/app/(app)/profile/actions.ts" \
        "src/app/(app)/profile/page.tsx" \
        src/components/profile/ProfileForm.tsx \
        src/components/profile/ProfileForm.test.tsx \
        src/components/profile/AvatarEditor.tsx \
        src/components/profile/AvatarEditor.test.tsx
git commit -m "feat(profile): Perfil tab — avatar upload + name/language form"
```

---

## Task 10: CVs tab — actions + CvList + CvRow + page

**Files:**
- Modify: `src/app/(app)/profile/actions.ts` (append CV actions)
- Create: `src/components/profile/CvList.tsx`
- Create: `src/components/profile/CvRow.tsx`
- Create: `src/app/(app)/profile/cvs/page.tsx`
- Test: `src/components/profile/CvRow.test.tsx`

- [ ] **Step 1: Append CV server actions**

Add to `src/app/(app)/profile/actions.ts`:

```ts
// CVs
const cvIdSchema = z.object({ cvId: z.string().uuid() });
const renameSchema = z.object({
  cvId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
});
const prepIdSchema = z.object({ prepSessionId: z.string().uuid() });

export async function deleteUploadedCv(input: z.infer<typeof cvIdSchema>): Promise<ActionResult> {
  const parsed = cvIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  // Look up file_path before deleting the row so we can clean up storage.
  const { data: row } = await supabase
    .from("cvs")
    .select("file_path")
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id)
    .single();

  const { error } = await supabase
    .from("cvs")
    .delete()
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: error.message };

  if (row?.file_path) {
    await supabase.storage.from("cvs").remove([row.file_path]);
  }

  revalidatePath("/profile/cvs");
  return { ok: true };
}

export async function renameUploadedCv(input: z.infer<typeof renameSchema>): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("cvs")
    .update({ display_name: parsed.data.displayName })
    .eq("id", parsed.data.cvId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile/cvs");
  return { ok: true };
}

export async function deleteAiCvRewrite(input: z.infer<typeof prepIdSchema>): Promise<ActionResult> {
  const parsed = prepIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID inválido." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };

  const { error } = await supabase
    .from("prep_sessions")
    .update({ cv_rewrite: null, cv_rewrite_status: "pending", cv_rewrite_error: null })
    .eq("id", parsed.data.prepSessionId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile/cvs");
  return { ok: true };
}
```

- [ ] **Step 2: Write failing test for CvRow**

```tsx
// src/components/profile/CvRow.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CvRow } from "./CvRow";
import type { UnifiedCv } from "@/lib/profile/types";

const noop = async () => ({ ok: true as const });

const upload: UnifiedCv = {
  origin: "upload",
  id: "u1",
  displayName: "Meu CV.pdf",
  fileName: "Meu CV.pdf",
  sizeBytes: 50_000,
  mimeType: "application/pdf",
  createdAt: "2026-04-20T10:00:00Z",
};

const ai: UnifiedCv = {
  origin: "ai",
  prepSessionId: "p1",
  companyName: "Acme",
  jobTitle: "Engenheiro",
  updatedAt: "2026-04-22T10:00:00Z",
};

describe("<CvRow />", () => {
  it("renderiza chip 'Original' para upload", () => {
    const { getByText } = render(
      <CvRow cv={upload} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    expect(getByText("Original")).toBeInTheDocument();
  });

  it("renderiza chip 'Reescrito pela IA' para ai", () => {
    const { getByText } = render(
      <CvRow cv={ai} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    expect(getByText("Reescrito pela IA")).toBeInTheDocument();
  });

  it("ai não mostra opção 'Renomear'", () => {
    const { getByRole, queryByText } = render(
      <CvRow cv={ai} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    fireEvent.click(getByRole("button", { name: /opções/i }));
    expect(queryByText("Renomear")).toBeNull();
  });

  it("upload mostra 'Renomear' no menu", () => {
    const { getByRole, getByText } = render(
      <CvRow cv={upload} deleteUpload={noop} rename={noop} deleteAi={noop} />,
    );
    fireEvent.click(getByRole("button", { name: /opções/i }));
    expect(getByText("Renomear")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement CvRow**

```tsx
// src/components/profile/CvRow.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UnifiedCv } from "@/lib/profile/types";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function CvRow({
  cv,
  deleteUpload,
  rename,
  deleteAi,
}: {
  cv: UnifiedCv;
  deleteUpload: (input: { cvId: string }) => Promise<ActionResult>;
  rename: (input: { cvId: string; displayName: string }) => Promise<ActionResult>;
  deleteAi: (input: { prepSessionId: string }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(
    cv.origin === "upload" ? cv.displayName : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isUpload = cv.origin === "upload";
  const title = isUpload ? cv.displayName : `${cv.companyName} — ${cv.jobTitle}`;
  const timestamp = isUpload ? cv.createdAt : cv.updatedAt;
  const downloadHref = isUpload
    ? `/api/cv/${cv.id}/download`            // see Task 11 for endpoint definition
    : `/prep/${cv.prepSessionId}/cv-rewrite.docx`;

  const onDelete = () => {
    setError(null);
    if (!confirm("Excluir este CV?")) return;
    startTransition(async () => {
      const result = isUpload
        ? await deleteUpload({ cvId: cv.id })
        : await deleteAi({ prepSessionId: cv.prepSessionId });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  const onRenameSubmit = () => {
    if (!isUpload) return;
    setError(null);
    startTransition(async () => {
      const result = await rename({ cvId: cv.id, displayName: draftName.trim() });
      if (!result.ok) setError(result.error);
      else {
        setRenaming(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border bg-bg p-4">
      <div className="min-w-0 flex-1">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={pending}
              onClick={onRenameSubmit}
              className="text-sm font-medium text-brand-600"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setDraftName(cv.origin === "upload" ? cv.displayName : "");
              }}
              className="text-sm text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-medium text-text-primary">{title}</p>
        )}
        <p className="mt-1 text-xs text-text-tertiary">
          {new Date(timestamp).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <span
        className={`shrink-0 rounded-pill border px-2 py-0.5 text-xs font-medium ${
          isUpload
            ? "border-line text-text-secondary"
            : "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950"
        }`}
      >
        {isUpload ? "Original" : "Reescrito pela IA"}
      </span>
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label="Opções"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-text-secondary hover:bg-line"
        >
          •••
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-44 rounded-md border border-border bg-bg shadow-prep"
          >
            <Link
              href={downloadHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-text-primary hover:bg-line"
            >
              Baixar
            </Link>
            {isUpload && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setRenaming(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-line"
              >
                Renomear
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-line"
            >
              Excluir
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 4: Implement CvList (server component) + page**

```tsx
// src/components/profile/CvList.tsx
import { createClient } from "@/lib/supabase/server";
import { mergeCvs } from "@/lib/profile/cv-merge";
import type { AiRewriteRow, UploadedCvRow } from "@/lib/profile/types";
import { CvRow } from "./CvRow";
import {
  deleteUploadedCv,
  renameUploadedCv,
  deleteAiCvRewrite,
} from "@/app/(app)/profile/actions";

export async function CvList() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [uploadedRes, rewritesRes] = await Promise.all([
    supabase
      .from("cvs")
      .select("id, file_name, display_name, file_size_bytes, mime_type, created_at")
      .eq("user_id", auth.user.id),
    supabase
      .from("prep_sessions")
      .select("id, company_name, job_title, cv_rewrite_status, updated_at")
      .eq("user_id", auth.user.id)
      .eq("cv_rewrite_status", "complete"),
  ]);

  const list = mergeCvs(
    (uploadedRes.data ?? []) as UploadedCvRow[],
    (rewritesRes.data ?? []) as AiRewriteRow[],
  );

  if (list.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-text-secondary">
        Você ainda não tem CVs.{" "}
        <a href="/prep/new" className="text-brand-600 underline">
          Criar meu primeiro prep
        </a>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {list.map((cv) => (
        <CvRow
          key={cv.origin === "upload" ? `u:${cv.id}` : `a:${cv.prepSessionId}`}
          cv={cv}
          deleteUpload={deleteUploadedCv}
          rename={renameUploadedCv}
          deleteAi={deleteAiCvRewrite}
        />
      ))}
    </ul>
  );
}
```

```tsx
// src/app/(app)/profile/cvs/page.tsx
import { CvList } from "@/components/profile/CvList";

export default function ProfileCvsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-text-primary">Seus CVs</h2>
        <p className="text-sm text-text-secondary">
          Originais que você enviou e versões reescritas pela IA.
        </p>
      </header>
      <CvList />
    </div>
  );
}
```

- [ ] **Step 5: Run tests + typecheck + commit**

```bash
pnpm test src/components/profile/CvRow.test.tsx
pnpm typecheck

git add "src/app/(app)/profile/actions.ts" \
        "src/app/(app)/profile/cvs/page.tsx" \
        src/components/profile/CvList.tsx \
        src/components/profile/CvRow.tsx \
        src/components/profile/CvRow.test.tsx
git commit -m "feat(profile): CVs tab — unified list with upload/AI rows + actions"
```

---

## Task 11: Download endpoint for uploaded CVs

The existing repo has no `/api/cv/[id]/download` route. CVs in storage are private. We need a route that streams the user's own file via signed URL redirect.

**Files:**
- Create: `src/app/api/cv/[id]/download/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/cv/[id]/download/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("cvs")
    .select("file_path, file_name")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();
  if (error || !row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed, error: signErr } = await supabase.storage
    .from("cvs")
    .createSignedUrl(row.file_path, 60, { download: row.file_name });
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "sign failed" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
```

- [ ] **Step 2: Smoke test (manual)**

```bash
pnpm dev
# Login → /profile/cvs → click "Baixar" on an uploaded CV → file downloads
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/cv/[id]/download/route.ts"
git commit -m "feat(api): GET /api/cv/[id]/download via signed URL"
```

---

## Task 12: Conta tab — change password dialog

**Files:**
- Create: `src/components/profile/ChangePasswordDialog.tsx`
- Modify: `src/app/(app)/profile/actions.ts` (append `changePassword`)

- [ ] **Step 1: Append changePassword action**

Add to `src/app/(app)/profile/actions.ts`:

```ts
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export async function changePassword(
  input: z.infer<typeof changePasswordSchema>,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Senha nova precisa ter pelo menos 8 caracteres." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !auth.user.email) return { ok: false, error: "Não autenticado." };

  // Reauthenticate by attempting sign-in with current password.
  const { error: reAuthErr } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.currentPassword,
  });
  if (reAuthErr) return { ok: false, error: "Senha atual incorreta." };

  const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}
```

- [ ] **Step 2: Implement ChangePasswordDialog**

```tsx
// src/components/profile/ChangePasswordDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function ChangePasswordDialog({
  action,
}: {
  action: (i: { currentPassword: string; newPassword: string }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) {
      setError("As senhas novas não coincidem.");
      return;
    }
    if (next.length < 8) {
      setError("A senha nova precisa ter pelo menos 8 caracteres.");
      return;
    }
    startTransition(async () => {
      const result = await action({ currentPassword: current, newPassword: next });
      if (result.ok) {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setError(result.error);
      }
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Trocar senha
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-lg bg-bg p-6 shadow-prep"
      >
        <h3 className="text-lg font-semibold text-text-primary">Trocar senha</h3>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="cur-pwd">
            Senha atual
          </label>
          <input
            id="cur-pwd"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="new-pwd">
            Nova senha
          </label>
          <input
            id="new-pwd"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary" htmlFor="cnf-pwd">
            Confirme a nova senha
          </label>
          <input
            id="cnf-pwd"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-700">Senha trocada com sucesso.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            Fechar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add "src/app/(app)/profile/actions.ts" \
        src/components/profile/ChangePasswordDialog.tsx
git commit -m "feat(profile): change password dialog + action"
```

---

## Task 13: Conta tab — delete account dialog

**Files:**
- Create: `src/components/profile/DeleteAccountDialog.tsx`
- Test: `src/components/profile/DeleteAccountDialog.test.tsx`
- Modify: `src/app/(app)/profile/actions.ts` (append `deleteAccount`)

`auth.users` cannot be deleted from a user-scoped client. We need to call the admin API with the service role key — which lives in `SUPABASE_SERVICE_ROLE_KEY`. Use a server-only admin client.

- [ ] **Step 1: Add the admin client helper**

```ts
// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Append deleteAccount action**

Add to `src/app/(app)/profile/actions.ts`:

```ts
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteAccountSchema = z.object({
  confirmation: z.literal("EXCLUIR"),
});

export async function deleteAccount(
  input: z.infer<typeof deleteAccountSchema>,
): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confirmação inválida." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado." };
  const uid = auth.user.id;

  // Best-effort storage cleanup. List + remove (paths under {uid}/).
  for (const bucket of ["cvs", "avatars"] as const) {
    const { data: files } = await supabase.storage.from(bucket).list(uid);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${uid}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  // Delete the auth user (cascades profiles, cvs, prep_sessions).
  const admin = createAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return { ok: false, error: delErr.message };

  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 3: Write failing test for DeleteAccountDialog**

```tsx
// src/components/profile/DeleteAccountDialog.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

describe("<DeleteAccountDialog />", () => {
  it("submit começa desabilitado", () => {
    const { getByRole } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("habilita submit quando input === 'EXCLUIR'", () => {
    const { getByRole, getByLabelText } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    fireEvent.change(getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR" } });
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("não habilita com texto incorreto", () => {
    const { getByRole, getByLabelText } = render(<DeleteAccountDialog action={vi.fn()} />);
    fireEvent.click(getByRole("button", { name: /excluir minha conta/i }));
    fireEvent.change(getByLabelText(/digite excluir/i), { target: { value: "Excluir" } });
    const submit = getByRole("button", { name: /excluir definitivamente/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
```

- [ ] **Step 4: Implement DeleteAccountDialog**

```tsx
// src/components/profile/DeleteAccountDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/(app)/profile/actions";

export function DeleteAccountDialog({
  action,
}: {
  action: (i: { confirmation: "EXCLUIR" }) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (text !== "EXCLUIR") return;
    startTransition(async () => {
      const result = await action({ confirmation: "EXCLUIR" });
      if (!result.ok) setError(result.error);
      // success: action redirects, no client work needed
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-lg bg-bg p-6 shadow-prep"
      >
        <h3 className="text-lg font-semibold text-text-primary">Excluir minha conta</h3>
        <p className="text-sm text-text-secondary">
          Essa ação é permanente. Todos os seus preps, CVs e dados serão excluídos
          imediatamente. Digite <strong>EXCLUIR</strong> para confirmar.
        </p>
        <div>
          <label htmlFor="del-confirm" className="mb-1 block text-sm text-text-secondary">
            Digite EXCLUIR para confirmar
          </label>
          <input
            id="del-confirm"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setText("");
              setError(null);
            }}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={text !== "EXCLUIR" || pending}
          >
            {pending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run test + typecheck + commit**

```bash
pnpm test src/components/profile/DeleteAccountDialog.test.tsx
pnpm typecheck

git add src/lib/supabase/admin.ts \
        "src/app/(app)/profile/actions.ts" \
        src/components/profile/DeleteAccountDialog.tsx \
        src/components/profile/DeleteAccountDialog.test.tsx
git commit -m "feat(profile): delete account dialog + admin-API action"
```

---

## Task 14: Conta tab — page (tier readout + change password + delete)

**Files:**
- Create: `src/components/profile/AccountSection.tsx`
- Create: `src/app/(app)/profile/account/page.tsx`

- [ ] **Step 1: Implement AccountSection**

```tsx
// src/components/profile/AccountSection.tsx
"use client";

import { useProfileShell } from "./ProfileShellProvider";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { Button } from "@/components/ui/Button";
import { changePassword, deleteAccount } from "@/app/(app)/profile/actions";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export function AccountSection() {
  const data = useProfileShell();
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Plano</h2>
        <div className="rounded-md border border-border p-4">
          <p className="text-sm text-text-primary">
            Você está no plano <strong>{TIER_LABEL[data.tier] ?? data.tier}</strong>.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {data.prepsUsedThisMonth}{" "}
            {data.prepsUsedThisMonth === 1 ? "prep usado" : "preps usados"} este mês.
          </p>
          <div className="mt-3">
            <Button variant="ghost" disabled>
              Gerenciar assinatura
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Segurança</h2>
        <div className="rounded-md border border-border p-4">
          <ChangePasswordDialog action={changePassword} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-red-700">Zona de perigo</h2>
        <div className="rounded-md border border-red-300 bg-red-50 p-4 dark:bg-red-950/30">
          <p className="mb-2 text-sm text-text-primary">
            Excluir sua conta apaga permanentemente todos os seus preps, CVs, e
            dados de perfil. Não há como desfazer.
          </p>
          <DeleteAccountDialog action={deleteAccount} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Implement the page**

```tsx
// src/app/(app)/profile/account/page.tsx
import { AccountSection } from "@/components/profile/AccountSection";

export default function ProfileAccountPage() {
  return <AccountSection />;
}
```

- [ ] **Step 3: Typecheck + smoke + commit**

```bash
pnpm typecheck
pnpm dev
# Visit /profile/account: tier renders, change password works, delete dialog opens.

git add src/components/profile/AccountSection.tsx \
        "src/app/(app)/profile/account/page.tsx"
git commit -m "feat(profile): Conta tab — tier readout + change password + delete account"
```

---

## Task 15: Final pass — full test run, lint, smoke

- [ ] **Step 1: Run the whole test suite**

```bash
pnpm test
```

Expected: PASS — no regressions in existing tests, all new tests pass.

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: typecheck passes; lint shows only pre-existing warnings (`prepSectionSchema`, `z` in `prompts/section-generator.ts`).

- [ ] **Step 3: Manual smoke (browser)**

```bash
pnpm dev
```

Walk this checklist in the browser logged in:

- [ ] Header shows Gravatar avatar (default), dropdown opens, "Sair" works.
- [ ] `/profile` renders, "Alterar foto" uploads a JPG ≤ 2MB, header avatar updates after `router.refresh()`.
- [ ] "Remover foto" reverts to Gravatar.
- [ ] Name + language form persists across reload.
- [ ] `/profile/cvs` renders both an uploaded CV (with rename) and an AI-rewritten CV (with download). Delete on each confirms and removes the row.
- [ ] `/profile/account` shows tier + uso, "Trocar senha" works with the right current password, "Excluir minha conta" only enables on `EXCLUIR`. (Don't actually delete on the prod account.)

- [ ] **Step 4: Final commit (only if anything changed)**

```bash
git status   # if clean, skip
```

---

## Self-review notes

**Spec coverage:**
- §4.1 routes — Tasks 5, 8, 9, 10, 11, 14 ✓
- §4.2 header dropdown — Task 7 ✓
- §4.3 ProfileShellProvider + Tabs — Task 8 ✓
- §5.1 migration — Task 1 ✓
- §5.2 storage layout — Tasks 1 + 9 (uploadFn path) ✓
- §5.3 / §5.4 unified list query + types — Tasks 3 + 10 ✓
- §6 server actions — Tasks 9, 10, 12, 13 ✓
- §7 avatar flow — Task 9 (AvatarEditor + uploadFn + updateAvatarPath) ✓
- §8 components — covered across Tasks 6–14 ✓
- §9 UX details — Tasks 8 (tabs visual), 9 (avatar caption), 10 (chips, action menu), 13 (delete copy) ✓
- §10 error handling — Tasks 9, 12, 13 (inline errors, retry, no transactional delete) ✓
- §11 testing — Tasks 2, 3, 4, 6, 7, 8, 9, 10, 13 ✓
- §12 rollout — order matches Tasks 1 → 14 ✓
- §13 known edges — Tier "Gerenciar assinatura" disabled in Task 14, no rate limiting on changePassword (deferred), no audit trail on delete (deferred) ✓
