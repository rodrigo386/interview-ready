import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Direitos LGPD · PrepaVAGA",
  description:
    "Como exercer seus direitos como titular de dados na PrepaVAGA, conforme a Lei Geral de Proteção de Dados (LGPD).",
};

export default function LgpdPage() {
  return (
    <LegalLayout title="Seus direitos LGPD" updatedAt="26 de abril de 2026">
      <p className="text-lg text-text-primary">
        A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante a você, titular dos dados, o
        controle sobre como suas informações pessoais são tratadas. Esta página resume esses
        direitos e mostra como exercê-los na PrepaVAGA.
      </p>

      <Section number="1." title="O que são meus dados na PrepaVAGA">
        <p>
          Coletamos: nome, e-mail, CPF, currículo (que você enviou), descrições de vaga, dossiês
          gerados, histórico de pagamentos. Detalhes completos na{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/privacidade">
            Política de Privacidade
          </Link>
          .
        </p>
      </Section>

      <Section number="2." title="Seus 9 direitos como titular">
        <p>Conforme o art. 18 da LGPD, você pode pedir, a qualquer momento:</p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            <strong className="text-text-primary">Confirmação:</strong> saber se tratamos seus
            dados pessoais.
          </li>
          <li>
            <strong className="text-text-primary">Acesso:</strong> receber uma cópia dos dados que
            temos sobre você.
          </li>
          <li>
            <strong className="text-text-primary">Correção:</strong> atualizar dados incompletos,
            inexatos ou desatualizados.
          </li>
          <li>
            <strong className="text-text-primary">Anonimização ou eliminação:</strong> remover
            dados desnecessários, excessivos ou tratados de forma irregular.
          </li>
          <li>
            <strong className="text-text-primary">Portabilidade:</strong> receber seus dados em
            formato estruturado para levar a outro serviço.
          </li>
          <li>
            <strong className="text-text-primary">Eliminação por revogação de consentimento:</strong>{" "}
            apagar dados tratados com base no seu consentimento, quando aplicável.
          </li>
          <li>
            <strong className="text-text-primary">Informação sobre compartilhamento:</strong> saber
            com que entidades públicas e privadas compartilhamos seus dados.
          </li>
          <li>
            <strong className="text-text-primary">Informação sobre não consentimento:</strong>{" "}
            saber as consequências de negar consentimento (geralmente, impossibilidade de usar o
            serviço).
          </li>
          <li>
            <strong className="text-text-primary">Revogação do consentimento</strong> a qualquer
            momento.
          </li>
        </ol>
      </Section>

      <Section number="3." title="Como exercer">
        <p>
          O caminho mais rápido pra muitos direitos é o próprio painel:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Acessar e corrigir dados de cadastro:</strong>{" "}
            <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile">
              Meu perfil
            </Link>
            .
          </li>
          <li>
            <strong className="text-text-primary">Baixar seus CVs originais:</strong>{" "}
            <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile/cvs">
              Perfil &gt; CVs
            </Link>
            .
          </li>
          <li>
            <strong className="text-text-primary">Apagar a conta inteira</strong> (eliminação total
            dos dados em até 30 dias):{" "}
            <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile/account">
              Perfil &gt; Conta
            </Link>
            .
          </li>
          <li>
            <strong className="text-text-primary">Cancelar assinatura</strong> Pro: mesmo lugar.
          </li>
        </ul>
        <p>Para os demais direitos (portabilidade, anonimização, esclarecimentos):</p>
        <p className="rounded-lg border border-neutral-200 bg-bg p-4 dark:border-zinc-800">
          Escreva pra{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:privacidade@prepavaga.com.br">
            privacidade@prepavaga.com.br
          </a>{" "}
          com o assunto <strong className="text-text-primary">&ldquo;Direito LGPD&rdquo;</strong> e
          descreva qual direito quer exercer. Respondemos em até{" "}
          <strong className="text-text-primary">15 dias corridos</strong>.
        </p>
        <p>
          Para confirmar sua identidade (segurança), podemos pedir validação adicional, como o
          e-mail cadastrado e os 3 últimos dígitos do CPF.
        </p>
      </Section>

      <Section number="4." title="Reclamação à ANPD">
        <p>
          Se você acha que não respondemos adequadamente ou que tratamos seus dados de forma
          irregular, pode registrar reclamação na Autoridade Nacional de Proteção de Dados (ANPD):
        </p>
        <p>
          <a
            className="text-brand-600 underline-offset-4 hover:underline"
            href="https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados"
            target="_blank"
            rel="noopener noreferrer"
          >
            gov.br/anpd &gt; Canal do Titular
          </a>
        </p>
      </Section>

      <Section number="5." title="Encarregado de Proteção de Dados (DPO)">
        <p>
          O DPO é a pessoa responsável por receber e responder às suas solicitações LGPD.
        </p>
        <p>
          Controlador: <strong className="text-text-primary">PROAICIRCLE CONSULTORIA EMPRESARIAL
          LTDA</strong> · CNPJ 62.805.016/0001-29 · Rua Pais Leme, 215, Conj. 1713, Pinheiros,
          São Paulo/SP, CEP 05.424-150.
        </p>
        <p>
          E-mail:{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:privacidade@prepavaga.com.br">
            privacidade@prepavaga.com.br
          </a>
        </p>
      </Section>
    </LegalLayout>
  );
}
