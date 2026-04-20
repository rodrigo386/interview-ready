# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the InterviewReady Foundation — a deployed Next.js 15 app with Supabase-backed email/password + Google OAuth authentication, protected dashboard, dark theme, CI, and Railway deploy.

**Architecture:** Next.js 15 App Router + React 19 + `@supabase/ssr` (cookie sessions) + Tailwind v4 (dark zinc + violet accent) + Supabase Postgres (profiles + RLS + trigger) + Railway (Docker) + GitHub Actions CI.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), pnpm, Tailwind CSS v4, Supabase (@supabase/ssr, @supabase/supabase-js), Zod, Vitest, Playwright, next-intl, Docker, GitHub Actions.

**Tailwind v4 note:** Next.js 15's create-next-app installs Tailwind v4 which uses CSS-first config by default. We keep the legacy `tailwind.config.ts` as a single source of truth for design tokens, bridged via `@config "../../tailwind.config.ts"` in `globals.css`. Do not add `@theme` blocks to `globals.css` — all tokens live in `tailwind.config.ts`.

**Working directory:** `C:/Users/rgoal/Desktop/IAgentics/InterviewGuide` (Windows, bash/git bash). Project will be scaffolded in-place.

**Pre-existing files (do not overwrite):** `ARCHITECTURE.md`, `.gitignore`, `docs/superpowers/specs/2026-04-20-foundation-design.md`, `docs/superpowers/plans/2026-04-20-foundation.md`, `.git/`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-foundation-design.md`

---

## Task 1: Scaffold Next.js 15 project in-place

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/`
- Modify: `.gitignore` (append Next.js entries if missing)

- [ ] **Step 1: Pin pnpm and enable corepack**

Run:
```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm --version
```
Expected: `9.12.0`

- [ ] **Step 2: Scaffold Next.js in the current directory**

Run (the `.` means current dir; `--use-pnpm` forces pnpm; Next.js 15 is required because the plan relies on async `cookies()` and `searchParams` and on `useActionState` from React 19):
```bash
pnpm create next-app@15 . --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-pnpm
```
When prompted about non-empty directory, answer `y` to proceed. The installer will not overwrite `ARCHITECTURE.md` or the `docs/` folder.

Expected: files above created, `pnpm install` runs automatically.

- [ ] **Step 3: Pin Node engine and scripts**

Overwrite `package.json` fields (merge — keep whatever Next set). After merging, `package.json` should contain:
```json
{
  "name": "interview-ready",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": "20.x" },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```
Keep the `dependencies` and `devDependencies` blocks that `create-next-app` generated.

- [ ] **Step 4: Configure `next.config.ts` for standalone output**

Overwrite `next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 5: Configure Tailwind with dark theme + brand color**

Overwrite `tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#8b5cf6", // violet-500
          hover: "#7c3aed",   // violet-600
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Verify project builds**

Run:
```bash
pnpm typecheck && pnpm build
```
Expected: no type errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "chore: scaffold Next.js 15 app with Tailwind dark theme"
```

---

## Task 2: Install auth, DB, i18n, and testing dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add @supabase/ssr@^0.5.0 @supabase/supabase-js@^2.45.0 zod@^3.23.0 next-intl@^3.20.0
```

- [ ] **Step 2: Install dev dependencies**

```bash
pnpm add -D @playwright/test@^1.47.0 vitest@^2.1.0 @vitejs/plugin-react@^4.3.0 supabase@^1.200.0
```

- [ ] **Step 3: Verify installation**

```bash
pnpm list --depth=0 | grep -E "supabase|zod|next-intl|vitest|playwright"
```
Expected: lists all five packages at requested versions.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "chore: add auth, DB, i18n, and testing deps"
```

---

## Task 3: Zod-validated environment variables

**Files:**
- Create: `src/lib/env.ts`
- Create: `.env.example`

- [ ] **Step 1: Write failing test**

Create `src/lib/env.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws if required var missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    await expect(import("./env")).rejects.toThrow();
  });

  it("parses valid env", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://x.supabase.co");
  });
});
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Run test — expect failure**

```bash
pnpm test src/lib/env.test.ts
```
Expected: FAIL — module `./env` not found.

- [ ] **Step 4: Implement `src/lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. See .env.example for required keys.");
}

export const env = parsed.data;
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Create local `.env.local` with placeholder values for local dev**

```bash
cp .env.example .env.local
```
(Will be filled with real Supabase values in Task 7.)

- [ ] **Step 7: Run test — expect pass**

```bash
pnpm test src/lib/env.test.ts
```
Expected: PASS both tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts vitest.config.ts .env.example
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: Zod-validated env vars with fail-fast boot"
```

---

## Task 4: Supabase SSR clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 2: Create server client**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component; middleware will refresh.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create middleware session helper**

`src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isProtected = pathname.startsWith("/dashboard");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: Supabase SSR clients (browser, server, middleware)"
```

---

## Task 5: Root middleware file

**Files:**
- Create: `middleware.ts` (at project root, NOT inside src/)

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - files with an extension (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: auth middleware with protected-route redirects"
```

---

## Task 6: Local Supabase stack and initial migration

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/0001_initial.sql`

- [ ] **Step 1: Initialize Supabase project**

```bash
pnpm exec supabase init
```
When prompted "Generate VS Code settings for Deno?", answer `N`.
When prompted "Generate IntelliJ Settings?", answer `N`.

Expected: creates `supabase/config.toml` and `supabase/seed.sql`.

- [ ] **Step 2: Write initial migration**

Create `supabase/migrations/0001_initial.sql`:
```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'pt-br', 'es')),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  preps_used_this_month INT DEFAULT 0,
  preps_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 3: Start local Supabase stack (requires Docker Desktop)**

```bash
pnpm exec supabase start
```
Expected output includes local URLs and keys like:
```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

If Docker Desktop is not installed or running: install it from https://www.docker.com/products/docker-desktop/ and start it, then re-run.

- [ ] **Step 4: Copy the local keys into `.env.local`**

Overwrite `.env.local` with the values from the previous step output:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: Apply the migration**

```bash
pnpm exec supabase db reset
```
Expected: recreates DB and applies `0001_initial.sql`. No errors.

- [ ] **Step 6: Verify profile table exists**

```bash
pnpm exec supabase db dump --data-only --local 2>&1 | head -5
# Alternative direct check:
pnpm exec supabase db diff --local
```
Expected: no pending diff (migration already applied).

- [ ] **Step 7: Commit**

```bash
git add supabase/
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: initial migration with profiles table + auto-insert trigger"
```

---

## Task 7: Global dark theme and UI primitives

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`

- [ ] **Step 1: Overwrite `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html, body {
  background-color: #09090b; /* zinc-950 */
  color: #fafafa;
  min-height: 100vh;
}

body {
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}
```

- [ ] **Step 2: Overwrite `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewReady",
  description: "Walk into every interview like you already work there.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} dark`}>
      <body className="bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
```

Install geist font package:
```bash
pnpm add geist
```

- [ ] **Step 3: Create Button primitive**

`src/components/ui/Button.tsx`:
```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand hover:bg-brand-hover text-white",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-50 border border-zinc-700",
  ghost: "bg-transparent hover:bg-zinc-800 text-zinc-300",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...rest}
      />
    );
  },
);
Button.displayName = "Button";
```

- [ ] **Step 4: Create Input primitive**

`src/components/ui/Input.tsx`:
```tsx
import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${className}`}
        {...rest}
      />
    );
  },
);
Input.displayName = "Input";
```

- [ ] **Step 5: Verify build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/components/ui package.json pnpm-lock.yaml
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: dark theme + Button/Input UI primitives"
```

---

## Task 8: Landing page with CTA

**Files:**
- Overwrite: `src/app/page.tsx`

- [ ] **Step 1: Write landing page**

`src/app/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="bg-gradient-to-r from-violet-400 to-violet-200 bg-clip-text text-5xl font-bold text-transparent sm:text-6xl">
          InterviewReady
        </h1>
        <p className="mt-6 text-xl text-zinc-400">
          Walk into every interview like you already work there.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button variant="primary">Get started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run dev server and smoke-check manually**

```bash
pnpm dev
```
Open http://localhost:3000 — confirm title, subtitle, and two buttons render with dark theme. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: landing page hero with CTAs"
```

---

## Task 9: Signup page with Server Action

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/signup/actions.ts`
- Create: `src/components/auth/SignupForm.tsx`

- [ ] **Step 1: Create Server Action**

`src/app/(auth)/signup/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Name is required"),
});

export type SignupState = { error?: string };

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
```

- [ ] **Step 2: Create SignupForm client component**

`src/components/auth/SignupForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signup, type SignupState } from "@/app/(auth)/signup/actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signup,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm text-zinc-300">
          Full name
        </label>
        <Input id="fullName" name="fullName" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          Email
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-300">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-1"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create Signup page**

`src/app/(auth)/signup/page.tsx`:
```tsx
import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Already have one?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
        <div className="mt-8 space-y-6">
          <SignupForm />
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-zinc-800" />
            <span className="text-xs text-zinc-500">OR</span>
            <hr className="flex-1 border-zinc-800" />
          </div>
          <GoogleButton label="Sign up with Google" />
        </div>
      </div>
    </main>
  );
}
```

Note: `GoogleButton` is created in Task 11. Until then, `pnpm build` will fail. That's fine — we commit Signup + Login + GoogleButton together as one integrated flow. If running tasks strictly one-at-a-time, temporarily comment out the `<GoogleButton />` import and usage, then restore in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/signup src/components/auth/SignupForm.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: signup page with Server Action and Zod validation"
```

---

## Task 10: Login page with Server Action

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`
- Create: `src/components/auth/LoginForm.tsx`

- [ ] **Step 1: Create Server Action**

`src/app/(auth)/login/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Invalid email or password" };
  }

  redirect("/dashboard");
}
```

- [ ] **Step 2: Create LoginForm**

`src/components/auth/LoginForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, type LoginState } from "@/app/(auth)/login/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          Email
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-zinc-300">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create Login page**

`src/app/(auth)/login/page.tsx`:
```tsx
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

function OAuthErrorBanner({ searchParams }: { searchParams: { error?: string } }) {
  if (searchParams.error !== "oauth_failed") return null;
  return (
    <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      Google sign-in failed. Please try again.
    </p>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          New here?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Create an account
          </Link>
        </p>
        <div className="mt-8 space-y-6">
          <Suspense>
            <OAuthErrorBanner searchParams={params} />
          </Suspense>
          <LoginForm />
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-zinc-800" />
            <span className="text-xs text-zinc-500">OR</span>
            <hr className="flex-1 border-zinc-800" />
          </div>
          <GoogleButton label="Sign in with Google" />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/login src/components/auth/LoginForm.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: login page with Server Action"
```

---

## Task 11: Google OAuth button and callback route

**Files:**
- Create: `src/components/auth/GoogleButton.tsx`
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create GoogleButton**

`src/components/auth/GoogleButton.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function GoogleButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createClient();
    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appUrl}/auth/callback` },
    });
    if (error) {
      console.error("OAuth error:", error);
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={loading}
      className="w-full"
    >
      <GoogleIcon />
      <span className="ml-2">{loading ? "Redirecting..." : label}</span>
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2c-2 1.5-4.5 2.5-7.3 2.5-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.4 39.6 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2C41.8 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create callback route handler**

`src/app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth exchange error:", error);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```
Expected: build succeeds; signup + login pages with `<GoogleButton />` no longer error.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/GoogleButton.tsx src/app/auth/callback
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: Google OAuth button + callback route"
```

---

## Task 12: Dashboard layout (auth-gated) and empty state

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/actions.ts`

- [ ] **Step 1: Create logout Server Action**

`src/app/dashboard/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Create dashboard layout**

`src/app/dashboard/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { logout } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold">
            InterviewReady
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.email}</span>
            <form action={logout}>
              <Button variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard empty state**

`src/app/dashboard/page.tsx`:
```tsx
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-zinc-900 p-4 text-4xl">✨</div>
      <h1 className="mt-6 text-2xl font-semibold">Create your first prep</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        Upload your CV and paste a job description — we&apos;ll research the
        company, analyze the role, and build your interview playbook.
      </p>
      <Button disabled className="mt-8">
        New prep (coming soon)
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Build and verify**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: auth-gated dashboard with logout + empty state"
```

---

## Task 13: Error and not-found pages

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`

- [ ] **Step 1: Create error boundary**

`src/app/error.tsx`:
```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        We hit an unexpected error. Try again, or head back home.
      </p>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-zinc-600">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create 404 page**

`src/app/not-found.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold text-zinc-700">404</h1>
      <p className="mt-4 text-lg text-zinc-300">Page not found</p>
      <Link href="/" className="mt-8">
        <Button>Back home</Button>
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/error.tsx src/app/not-found.tsx
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: styled error + 404 pages"
```

---

## Task 14: i18n scaffold (EN only)

**Files:**
- Create: `src/i18n/config.ts`
- Create: `src/i18n/messages/en.json`

- [ ] **Step 1: Create config**

`src/i18n/config.ts`:
```ts
export const locales = ["en", "pt-br", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
```

- [ ] **Step 2: Create base messages file**

`src/i18n/messages/en.json`:
```json
{
  "landing": {
    "tagline": "Walk into every interview like you already work there.",
    "cta_get_started": "Get started",
    "cta_sign_in": "Sign in"
  },
  "auth": {
    "create_account": "Create your account",
    "sign_in": "Sign in",
    "email": "Email",
    "password": "Password",
    "full_name": "Full name",
    "sign_up_google": "Sign up with Google",
    "sign_in_google": "Sign in with Google",
    "or": "OR"
  },
  "dashboard": {
    "greeting": "Create your first prep",
    "empty_hint": "Upload your CV and paste a job description — we'll research the company, analyze the role, and build your interview playbook.",
    "new_prep": "New prep (coming soon)",
    "sign_out": "Sign out"
  }
}
```

Not wired to `next-intl` provider yet — full i18n integration is part of sub-project #5 (Polish). This commit just establishes the structure so future strings can be added centrally.

- [ ] **Step 3: Commit**

```bash
git add src/i18n
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "chore: scaffold i18n (next-intl) with EN messages"
```

---

## Task 15: Playwright smoke test (signup → dashboard)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Create Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm start",
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 2: Install browser**

```bash
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 3: Create smoke test**

`tests/e2e/auth.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("signup with email lands on dashboard empty state", async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(uniqueEmail);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Create your first prep" })).toBeVisible();
});
```

- [ ] **Step 4: Ensure Supabase is running locally and app builds**

```bash
pnpm exec supabase status
pnpm build
```
If `supabase status` reports stopped: `pnpm exec supabase start`.

- [ ] **Step 5: Disable email confirmation locally for the test**

Edit `supabase/config.toml` — find the `[auth.email]` block and set:
```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```
Then restart the local stack:
```bash
pnpm exec supabase stop
pnpm exec supabase start
```
(In production we WILL require email confirmation — that's handled in sub-project #5 Polish.)

- [ ] **Step 6: Run the smoke test**

```bash
pnpm test:e2e
```
Expected: PASS — 1 test passed in ~10s.

If it fails with timeout on `/dashboard`: check that the `handle_new_user` trigger exists (`pnpm exec supabase db diff --local` should show no pending changes) and that env vars match the `supabase start` output.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/ supabase/config.toml
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "test: Playwright smoke for signup → dashboard"
```

---

## Task 16: Dockerfile for Railway

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
.env
.env.local
.env.*.local
tests
playwright-report
test-results
coverage
docs
supabase
*.md
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV SUPABASE_SERVICE_ROLE_KEY=placeholder_build_time
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Note on `NEXT_PUBLIC_*` at build time: Next inlines them into the client bundle during `pnpm build`, so they must be present at image-build time. Railway reads the `ARG` values from its service env vars by default. `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (runtime), so a placeholder at build time is fine.

- [ ] **Step 3: Build image locally to verify**

```bash
docker build -t interview-ready:test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  .
```
Expected: build completes; final image < 300MB.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "feat: Dockerfile for Railway (standalone output, non-root user)"
```

---

## Task 17: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9.12.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Install Playwright browser
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm exec playwright test

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "ci: lint + typecheck + build + unit + e2e on every PR"
```

Note: the CI will fail on first PR until `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, and `STAGING_SUPABASE_SERVICE_ROLE_KEY` are added as GitHub secrets. That's a manual step in Task 19.

---

## Task 18: README with dev setup instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# InterviewReady

AI-powered interview prep SaaS. Turns any CV + job description into a personalized, interactive interview prep guide with company intel, ATS gap analysis, and mock interview chat.

See `ARCHITECTURE.md` for the product vision and full stack design. See `docs/superpowers/specs/` and `docs/superpowers/plans/` for sub-project specs and implementation plans.

## Current status

**Sub-project #1 (Foundation):** auth, protected dashboard, Railway deploy.

## Local development

### Prerequisites

- Node.js 20 LTS
- pnpm 9.12+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker Desktop (for local Supabase stack)

### Setup

```bash
pnpm install
cp .env.example .env.local

# Start local Supabase (Postgres + Auth + Storage in Docker)
pnpm exec supabase start

# Copy the `anon key` and `service_role key` printed by `supabase start` into .env.local.
# Also set:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

pnpm dev
```

Open http://localhost:3000.

### Running tests

```bash
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E smoke test (Playwright, requires Supabase running)
pnpm lint
pnpm typecheck
```

### Stopping local Supabase

```bash
pnpm exec supabase stop
```

## Deployment

Auto-deployed to Railway on push to `main`. See `docs/superpowers/specs/2026-04-20-foundation-design.md` §8 for deploy architecture.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git -c user.email="dev@interviewready.local" -c user.name="InterviewReady Dev" \
  commit -m "docs: README with local dev setup"
```

---

## Task 19: Manual setup — production Supabase, Google OAuth, Railway, GitHub

This task has **no code** — it documents manual external actions the developer must perform. Record completion of each step as a comment on the Pull Request.

- [ ] **Step 1: Create GitHub repository and push**

```bash
# Create a private repo called "interview-ready" on github.com via the UI, then:
git remote add origin git@github.com:<your-username>/interview-ready.git
git push -u origin main
```

- [ ] **Step 2: Create production Supabase project**

1. Go to https://supabase.com/dashboard → New project
2. Name: `interview-ready-prod`, region: `us-east-1`, strong DB password
3. Wait for provisioning (~2 min)
4. Settings → API → copy `URL`, `anon public key`, `service_role key`
5. SQL Editor → paste contents of `supabase/migrations/0001_initial.sql` → Run
6. Authentication → Providers → enable Email (keep "Confirm email" ON for prod)

- [ ] **Step 3: Create staging Supabase project**

Repeat step 2 with name `interview-ready-staging`. This one will have email confirmation OFF (for the E2E test).

1. Authentication → Providers → Email → "Confirm email" → OFF
2. Copy the staging URL + anon key + service_role key

- [ ] **Step 4: Configure Google OAuth**

1. https://console.cloud.google.com/ → new project "InterviewReady"
2. APIs & Services → OAuth consent screen → External → fill app name, support email, dev email → Save
3. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID → Web application
4. Authorized redirect URIs: add these three
   - `http://127.0.0.1:54321/auth/v1/callback` (local dev)
   - `https://<prod-project-ref>.supabase.co/auth/v1/callback` (prod)
   - `https://<staging-project-ref>.supabase.co/auth/v1/callback` (staging)
5. Save → copy Client ID and Client Secret
6. In BOTH Supabase projects (prod + staging): Authentication → Providers → Google → enable → paste Client ID + Secret → Save

- [ ] **Step 5: Configure GitHub Secrets**

In the GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add:
- `STAGING_SUPABASE_URL` = staging URL
- `STAGING_SUPABASE_ANON_KEY` = staging anon key
- `STAGING_SUPABASE_SERVICE_ROLE_KEY` = staging service role key

- [ ] **Step 6: Deploy to Railway**

1. https://railway.app → New Project → Deploy from GitHub repo → select `interview-ready`
2. Railway detects Dockerfile, builds automatically
3. Settings → Variables → add:
   - `NEXT_PUBLIC_SUPABASE_URL` = prod URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = prod anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = prod service role key
   - `NEXT_PUBLIC_APP_URL` = (leave blank; set after domain generated)
4. Settings → Networking → Generate Domain → copy the `*.up.railway.app` URL
5. Settings → Variables → update `NEXT_PUBLIC_APP_URL` to the generated URL → redeploy
6. In the production Supabase project: Authentication → URL Configuration → Site URL = Railway URL; Redirect URLs = `<railway-url>/auth/callback`

- [ ] **Step 7: Update Google OAuth redirect URIs with production app URL**

In Google Cloud Console → Credentials → edit the OAuth client → add to Authorized redirect URIs:
- `<railway-url>/auth/callback`

(The Supabase `.supabase.co/auth/v1/callback` URIs remain — they handle the Supabase-side exchange.)

- [ ] **Step 8: Verify production deployment**

Visit the Railway URL, signup with a test email → confirm email from Supabase inbox → log in → land on dashboard.

Also test Google OAuth from the production site.

- [ ] **Step 9: Record completion**

Document in a `DEPLOY_NOTES.md` (not committed — keep locally or in a private note):
- Railway URL
- Prod Supabase project ref
- Staging Supabase project ref
- Google OAuth client ID (last 8 chars)

---

## Task 20: Final verification against Definition of Done

- [ ] **Step 1: Run DoD checklist against deployed app**

For each DoD item from the spec, verify and check off:

1. [ ] Signup email/password on production URL → lands on dashboard
2. [ ] Login email/password → lands on dashboard
3. [ ] Google OAuth → lands on dashboard
4. [ ] Logout → returns to landing
5. [ ] `/dashboard` without session → redirects to `/login`
6. [ ] `/login` with session → redirects to `/dashboard`
7. [ ] Row in `public.profiles` auto-created for each new signup (verify in Supabase SQL Editor: `SELECT id, email, full_name FROM public.profiles ORDER BY created_at DESC LIMIT 5;`)
8. [ ] RLS active — running `SELECT * FROM public.profiles;` from one user's session returns only that user's row
9. [ ] Deploy reachable at Railway HTTPS URL
10. [ ] CI pipeline green on latest PR — lint, typecheck, build, unit, E2E all pass
11. [ ] Dark theme (zinc-950 + violet-500) on landing, login, signup, dashboard, error, 404
12. [ ] `.env.example` exists with all four keys documented; boot fails fast with Zod error if any missing
13. [ ] README has clone → install → supabase start → dev workflow documented

- [ ] **Step 2: Tag the Foundation release**

```bash
git tag -a foundation-v1 -m "Foundation (sub-project #1) complete"
git push origin foundation-v1
```

- [ ] **Step 3: Announce completion**

Foundation sub-project is done. Ready to brainstorm sub-project #2 (Core Pipeline: CV/JD parsing, Claude API integration, prep guide generation, ATS analyzer).

---

## Post-implementation notes for future sub-projects

- Sub-project #2 will add tables: `cvs`, `prep_sessions`, `mock_interviews`. Create migration `0002_prep_tables.sql`.
- Sub-project #3 will add columns to `profiles`: `stripe_customer_id`, `stripe_subscription_id`. Create migration `0003_stripe.sql`.
- When enabling production email confirmation (sub-project #5 Polish), the staging Supabase can keep confirmation OFF to preserve the E2E smoke test. Production Supabase keeps confirmation ON.
- `next-intl` is scaffolded but not yet wired to the layout provider — sub-project #5 will add `<NextIntlClientProvider>` at the root and swap hardcoded strings for `t("...")` lookups.
