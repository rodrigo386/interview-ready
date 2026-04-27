import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminUser = {
  id: string;
  email: string;
};

/**
 * Resolve the current request's user, ensure they are flagged as admin in
 * profiles. Redirects to /login or /dashboard otherwise.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single();
  const isAdmin = (profile as { is_admin?: boolean } | null)?.is_admin === true;
  if (!isAdmin) {
    redirect("/dashboard");
  }
  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
  };
}

/** Read-only check for use in components (e.g. show admin link in menu). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single();
  return (profile as { is_admin?: boolean } | null)?.is_admin === true;
}
