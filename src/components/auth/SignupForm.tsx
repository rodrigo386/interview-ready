"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signup, type SignupState } from "@/app/(auth)/signup/actions";
import { isValidCepFormat, lookupCep, normalizeCep } from "@/lib/address/viacep";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signup,
    {},
  );
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  async function onCepBlur() {
    const cep = normalizeCep(postalCode);
    if (cep.length === 0) {
      setCepError(null);
      return;
    }
    if (!isValidCepFormat(cep)) {
      setCepError("CEP deve ter 8 dígitos");
      return;
    }
    setCepError(null);
    setCepLoading(true);
    const result = await lookupCep(cep);
    setCepLoading(false);
    if (!result) {
      setCepError("CEP não encontrado. Preencha os campos manualmente.");
      return;
    }
    setStreet(result.logradouro);
    setDistrict(result.bairro);
    setCity(result.cidade);
    setStateUf(result.uf);
  }

  if (state.pendingConfirmation) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <p className="font-medium">Confira seu e-mail.</p>
        <p className="mt-1 text-zinc-400">
          Enviamos um link de confirmação. Clique nele e volte aqui para entrar.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm text-zinc-300">
          Nome completo
        </label>
        <Input id="fullName" name="fullName" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm text-zinc-300">
          E-mail
        </label>
        <Input id="email" name="email" type="email" required className="mt-1" />
      </div>
      <div>
        <label htmlFor="cpfCnpj" className="block text-sm text-zinc-300">
          CPF ou CNPJ
        </label>
        <Input
          id="cpfCnpj"
          name="cpfCnpj"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Apenas números"
          required
          className="mt-1"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Necessário para emitir cobranças e nota fiscal (Asaas).
        </p>
      </div>

      <fieldset className="space-y-3 rounded-md border border-zinc-800 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Endereço (para nota fiscal)
        </legend>

        <div>
          <label htmlFor="postalCode" className="block text-sm text-zinc-300">
            CEP
          </label>
          <Input
            id="postalCode"
            name="postalCode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            required
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            onBlur={onCepBlur}
            className="mt-1"
          />
          {cepLoading && (
            <p className="mt-1 text-xs text-zinc-500">Buscando endereço…</p>
          )}
          {cepError && (
            <p className="mt-1 text-xs text-red-400" role="alert">
              {cepError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="addressStreet" className="block text-sm text-zinc-300">
            Logradouro
          </label>
          <Input
            id="addressStreet"
            name="addressStreet"
            type="text"
            autoComplete="address-line1"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="addressNumber"
              className="block text-sm text-zinc-300"
            >
              Número
            </label>
            <Input
              id="addressNumber"
              name="addressNumber"
              type="text"
              autoComplete="address-line2"
              placeholder="123 ou S/N"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="addressComplement"
              className="block text-sm text-zinc-300"
            >
              Complemento{" "}
              <span className="text-xs text-zinc-500">(opcional)</span>
            </label>
            <Input
              id="addressComplement"
              name="addressComplement"
              type="text"
              autoComplete="address-line3"
              placeholder="Apto, sala…"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="addressDistrict"
            className="block text-sm text-zinc-300"
          >
            Bairro
          </label>
          <Input
            id="addressDistrict"
            name="addressDistrict"
            type="text"
            autoComplete="address-level3"
            required
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div>
            <label
              htmlFor="addressCity"
              className="block text-sm text-zinc-300"
            >
              Cidade
            </label>
            <Input
              id="addressCity"
              name="addressCity"
              type="text"
              autoComplete="address-level2"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              htmlFor="addressState"
              className="block text-sm text-zinc-300"
            >
              UF
            </label>
            <Input
              id="addressState"
              name="addressState"
              type="text"
              autoComplete="address-level1"
              maxLength={2}
              required
              value={stateUf}
              onChange={(e) => setStateUf(e.target.value.toUpperCase())}
              className="mt-1 uppercase"
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="password" className="block text-sm text-zinc-300">
          Senha
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
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
