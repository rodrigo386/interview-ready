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
