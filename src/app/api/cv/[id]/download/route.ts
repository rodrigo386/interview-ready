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
