import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarMenu } from "@/components/ui/AvatarMenu";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { logout } from "./dashboard/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let resolvedAvatarUrl = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      let avatarPath: string | null = null;
      let avatarUpdatedAt: string | null = null;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url, avatar_updated_at")
          .eq("id", user.id)
          .single();
        avatarPath = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
        avatarUpdatedAt =
          (profile as { avatar_updated_at?: string | null } | null)?.avatar_updated_at ?? null;
      } catch (err) {
        console.warn(
          "[(app)/layout] profile fetch failed (migration may not be applied):",
          err,
        );
      }
      resolvedAvatarUrl = resolveAvatarUrl(
        { email: user.email!, avatarPath, avatarUpdatedAt },
        supabase,
      );
    }
  } catch (err) {
    console.error("[(app)/layout] auth check failed:", err);
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" aria-label="PrepaVaga — ir para o painel">
            <Logo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AvatarMenu
              email={user.email!}
              avatarUrl={resolvedAvatarUrl}
              logoutAction={logout}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
