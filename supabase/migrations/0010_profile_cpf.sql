-- 0010_profile_cpf.sql
-- Asaas requires cpfCnpj on customer creation; cache it on the profile so the
-- user enters it once and we reuse on every subsequent checkout.

ALTER TABLE public.profiles ADD COLUMN cpf_cnpj TEXT;
