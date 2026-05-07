"use client";

import { useState, useTransition } from "react";
import { applyAsAffiliate } from "@/app/parceiros/actions";
import { generateCodeFromName, validateCode } from "@/lib/affiliate/code";
import { safeCall } from "@/lib/affiliate/safe-action";

export function PartnerForm({ defaultName = "" }: { defaultName?: string }) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [code, setCode] = useState(generateCodeFromName(defaultName));
  const [autoCode, setAutoCode] = useState(true); // tracks whether code is auto-derived
  const [bio, setBio] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [why, setWhy] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleNameChange = (v: string) => {
    setDisplayName(v);
    if (autoCode) {
      setCode(generateCodeFromName(v));
    }
  };

  const handleCodeChange = (v: string) => {
    setAutoCode(false); // user manually edited; stop auto-deriving
    setCode(v.toUpperCase());
  };

  const codeValid = validateCode(code);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!codeValid) {
      setError("Código inválido (2-40 caracteres, A-Z, 0-9, hífen)");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("display_name", displayName);
      fd.set("code", code);
      fd.set("bio", bio);
      fd.set("pix_key", pixKey);
      fd.set("why", why);
      const wrapped = await safeCall(() => applyAsAffiliate(fd));
      if (!wrapped.ok) {
        setError(wrapped.message);
        return;
      }
      const res = wrapped.value;
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error ?? "Erro ao aplicar");
      }
    });
  };

  if (success) {
    return (
      <div className="rounded-xl border-2 border-green-500 bg-green-soft/30 p-6">
        <h2 className="text-lg font-bold text-green-700">Aplicação enviada!</h2>
        <p className="mt-2 text-sm text-ink-2">
          Recebemos sua aplicação. Respondemos em até 7 dias úteis no e-mail da sua conta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome ou nome do canal" required>
        <input
          type="text"
          value={displayName}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
        />
      </Field>
      <Field
        label="Código de afiliado (será o ?ref=)"
        required
        hint={codeValid ? `Seu link: prepavaga.com.br/?ref=${code}` : "Use só A-Z, 0-9 e hífen, 2-40 chars"}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          required
          maxLength={40}
          className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-ink"
        />
      </Field>
      <Field label="Bio curta" hint="Até 280 caracteres. Aparece pro time de aprovação.">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
        />
      </Field>
      <Field label="Chave Pix (pra receber pagamentos)" required>
        <input
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
        />
      </Field>
      <Field label="Pra que público você fala? Por que quer divulgar PrepaVAGA?" required>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          required
          rows={4}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink"
          placeholder="Ex: tenho um podcast de carreira com 5k ouvintes mensais. Acho que PrepaVAGA cobre exatamente o gap entre 'corrigi meu CV' e 'estou pronto pra entrevista'..."
        />
      </Field>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending || !codeValid}
        className="rounded-pill bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Aplicar"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-orange-700"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </label>
  );
}
