"use client";

import { useRef, useState, type RefObject } from "react";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { isValidCepFormat, lookupCep, normalizeCep } from "@/lib/address/viacep";

export type AddressDialogValue = {
  postalCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement?: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
};

export function AddressDialog({
  open,
  onCancel,
  onSubmit,
  pending,
}: {
  open: boolean;
  onCancel: () => void;
  onSubmit: (value: AddressDialogValue) => void;
  pending: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const cepRef = useRef<HTMLInputElement>(null);

  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [cepError, setCepError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setPostalCode("");
    setStreet("");
    setNumber("");
    setComplement("");
    setDistrict("");
    setCity("");
    setStateUf("");
    setCepError(null);
    setFormError(null);
  }

  function handleCancel() {
    if (pending) return;
    reset();
    onCancel();
  }

  useDialogFocus(
    open,
    formRef as RefObject<HTMLElement>,
    handleCancel,
    cepRef,
  );

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cep = normalizeCep(postalCode);
    if (cep.length !== 8) {
      setFormError("CEP deve ter 8 dígitos.");
      return;
    }
    if (
      !street.trim() ||
      !number.trim() ||
      !district.trim() ||
      !city.trim() ||
      stateUf.trim().length !== 2
    ) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }
    setFormError(null);
    const value: AddressDialogValue = {
      postalCode: cep,
      addressStreet: street.trim(),
      addressNumber: number.trim(),
      addressComplement: complement.trim() || undefined,
      addressDistrict: district.trim(),
      addressCity: city.trim(),
      addressState: stateUf.trim().toUpperCase(),
    };
    reset();
    onSubmit(value);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="address-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleCancel}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-lg bg-bg p-5 shadow-prep"
      >
        <h3
          id="address-dialog-title"
          className="text-base font-semibold text-text-primary"
        >
          Endereço pra nota fiscal
        </h3>
        <p className="text-sm text-text-secondary">
          O Asaas exige endereço completo pra emitir NFSe. Preenche uma vez e
          a gente reusa nos próximos pagamentos.
        </p>

        <div>
          <label
            htmlFor="checkout-address-cep"
            className="block text-xs font-medium text-text-secondary"
          >
            CEP
          </label>
          <input
            ref={cepRef}
            id="checkout-address-cep"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            onBlur={onCepBlur}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
          {cepLoading && (
            <p className="mt-1 text-xs text-text-tertiary">Buscando endereço…</p>
          )}
          {cepError && (
            <p className="mt-1 text-xs text-red-500" role="alert">
              {cepError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="checkout-address-street"
            className="block text-xs font-medium text-text-secondary"
          >
            Logradouro
          </label>
          <input
            id="checkout-address-street"
            type="text"
            autoComplete="address-line1"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="checkout-address-number"
              className="block text-xs font-medium text-text-secondary"
            >
              Número
            </label>
            <input
              id="checkout-address-number"
              type="text"
              autoComplete="address-line2"
              placeholder="123"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="checkout-address-complement"
              className="block text-xs font-medium text-text-secondary"
            >
              Complemento
              <span className="ml-1 font-normal text-text-tertiary">
                (opcional)
              </span>
            </label>
            <input
              id="checkout-address-complement"
              type="text"
              autoComplete="address-line3"
              placeholder="Apto, sala…"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="checkout-address-district"
            className="block text-xs font-medium text-text-secondary"
          >
            Bairro
          </label>
          <input
            id="checkout-address-district"
            type="text"
            autoComplete="address-level3"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div>
            <label
              htmlFor="checkout-address-city"
              className="block text-xs font-medium text-text-secondary"
            >
              Cidade
            </label>
            <input
              id="checkout-address-city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="checkout-address-state"
              className="block text-xs font-medium text-text-secondary"
            >
              UF
            </label>
            <input
              id="checkout-address-state"
              type="text"
              autoComplete="address-level1"
              maxLength={2}
              value={stateUf}
              onChange={(e) => setStateUf(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm uppercase"
            />
          </div>
        </div>

        {formError && (
          <p className="text-sm text-red-500" role="alert">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
