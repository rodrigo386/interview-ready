"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Name is required"),
});

export type SignupState = {
  error?: string;
  pendingConfirmation?: boolean;
};

function mapSupabaseError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "An account with this email already exists.";
  }
  return "We couldn't create your account. Please try again.";
}

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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return { error: mapSupabaseError(error.message) };
  }

  // If email confirmation is required, Supabase returns user but no session.
  if (!data.session) {
    return { pendingConfirmation: true };
  }

  redirect("/dashboard");
}
