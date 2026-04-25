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
