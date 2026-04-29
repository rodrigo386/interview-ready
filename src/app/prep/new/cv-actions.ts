"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  parseCvFile,
  ParseError,
  ACCEPTED_MIME_TYPES,
} from "@/lib/files/parse";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = "cvs";

export type UploadCvState = {
  error?: string;
  cv?: { id: string; file_name: string };
};

export async function uploadCv(
  _prev: UploadCvState,
  formData: FormData,
): Promise<UploadCvState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Faça login para enviar um CV." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo para enviar." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { error: `Limite de 5 MB. Este arquivo tem ${mb} MB.` };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
    return { error: "Apenas PDF, DOCX ou TXT são aceitos." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsedText: string;
  try {
    const result = await parseCvFile(buffer, file.type);
    parsedText = result.text;
  } catch (err) {
    if (err instanceof ParseError) return { error: err.message };
    console.error("[uploadCv] parse error:", err);
    return { error: "Não conseguimos ler este arquivo. Tente outro." };
  }

  const cvId = randomUUID();
  const ext = extFromMime(file.type);
  const path = `${user.id}/${cvId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    console.error("[uploadCv] storage upload failed:", uploadErr);
    return { error: "Falha no upload. Tente novamente." };
  }

  const { error: insertErr } = await supabase.from("cvs").insert({
    id: cvId,
    user_id: user.id,
    file_name: file.name,
    file_path: path,
    file_size_bytes: file.size,
    mime_type: file.type,
    parsed_text: parsedText,
  });

  if (insertErr) {
    // Log only message + code — the full error object echoes the row
    // payload (parsed_text = entire CV PDF text), which would write CV
    // PII to Railway logs.
    console.error("[uploadCv] DB insert failed:", insertErr.message, insertErr.code);
    // Best-effort rollback of storage object.
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: "Não foi possível salvar seu CV. Tente novamente." };
  }

  return { cv: { id: cvId, file_name: file.name } };
}

function extFromMime(mime: string): "pdf" | "docx" | "txt" {
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  return "txt";
}
