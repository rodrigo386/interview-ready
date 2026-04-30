-- 0015_profile_address.sql
--
-- Asaas requires customer address (postalCode, address, addressNumber,
-- province, complement opcional) para emitir NFSe pra clientes brasileiros.
-- Coletamos no signup pra reusar em todo checkout. Sem isso, NF não emite.
--
-- Campos:
--   postal_code         CEP no formato 12345-678 ou 12345678 (digits-only OK)
--   address_street      Logradouro (rua, avenida, travessa, etc)
--   address_number      Número (texto — pode ser "S/N", "123A")
--   address_complement  Complemento opcional (apto, sala, bloco)
--   address_district    Bairro
--   address_city        Cidade
--   address_state       UF (2 caracteres maiúsculos)
--
-- Os 6 obrigatórios são NULL inicialmente porque users que criaram conta
-- antes desta migration ainda não preencheram. Checkout passa a exigir
-- e preenche on-demand (via 422 address_required + form), mesmo padrão
-- usado pra cpf_cnpj.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_district TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT;

-- Estes 7 campos são user-managed (igual full_name/preferred_language).
-- Adiciona ao GRANT da migration 0011 — sem isso o user não consegue
-- editar o próprio endereço pelo /profile/account.
GRANT UPDATE (
  postal_code,
  address_street,
  address_number,
  address_complement,
  address_district,
  address_city,
  address_state
) ON public.profiles TO authenticated;

-- Constraint leve: UF deve ser 2 caracteres maiúsculos quando presente.
-- Não usamos CHECK rígido pra não quebrar inserts vindos de admin scripts.
COMMENT ON COLUMN public.profiles.address_state IS 'UF brasileira em 2 letras maiúsculas (SP, RJ, MG…). NULL se ainda não preenchido.';
COMMENT ON COLUMN public.profiles.postal_code IS 'CEP. Aceitamos 12345-678 ou 12345678. Asaas normaliza.';
