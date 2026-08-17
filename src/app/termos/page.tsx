import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos e condições para uso da plataforma PrepaVaga. Cadastro, planos, pagamentos, reembolso, cancelamento e responsabilidades.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso" path="/termos" updatedAt="17 de agosto de 2026">
      <p className="text-lg text-text-primary">
        Bem-vindo à PrepaVaga. Estes Termos regulam o uso da nossa plataforma de preparação para
        entrevistas com IA. Ao criar sua conta ou usar qualquer parte do serviço, você concorda
        integralmente com este documento. Se não concordar, por favor não use a PrepaVaga.
      </p>

      <Section number="1." title="Quem somos">
        <p>
          A PrepaVaga é operada pela <strong className="text-text-primary">PROAICIRCLE
          CONSULTORIA EMPRESARIAL LTDA</strong> (nome fantasia: <em>Pro AI Circle</em>),
          inscrita no CNPJ sob o nº <strong className="text-text-primary">62.805.016/0001-29</strong>,
          com sede na Rua Pais Leme, 215, Conjunto 1713, Pinheiros, São Paulo/SP, CEP 05.424-150.
        </p>
        <p>
          Oferecemos um software como serviço (SaaS) que gera dossiês personalizados de preparação
          para entrevistas, combinando inteligência artificial, análise de currículos e pesquisa
          pública sobre empresas.
        </p>
        <p>
          Para falar com a gente:{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:contato@prepavaga.com.br">
            contato@prepavaga.com.br
          </a>
          .
        </p>
      </Section>

      <Section number="2." title="Cadastro e elegibilidade">
        <p>
          Para usar a PrepaVaga, você precisa: (i) ter no mínimo 18 anos; (ii) fornecer e-mail
          válido, nome completo e CPF (ou CNPJ, se pessoa jurídica); (iii) criar uma senha segura;
          e (iv) manter seus dados atualizados.
        </p>
        <p>
          O CPF é obrigatório porque é exigido pelo nosso parceiro de pagamento (Asaas) para emitir
          cobranças e notas fiscais conforme a legislação brasileira. Sem CPF, não conseguimos
          processar qualquer pagamento.
        </p>
        <p>
          Você é responsável pela confidencialidade da sua senha e por toda atividade que ocorra
          na sua conta.
        </p>
      </Section>

      <Section number="3." title="Preços e pagamento">
        <p>
          Não há plano gratuito nem assinatura mensal. Oferecemos:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Análise ATS.</strong> Sempre gratuita, com ou
            sem cadastro. Mostra a nota de compatibilidade do seu currículo com a vaga e os
            principais ajustes de vocabulário.
          </li>
          <li>
            <strong className="text-text-primary">Preparação completa.</strong> R$ 10 por
            preparação (pesquisa da empresa, faixa salarial estimada, currículo reescrito e
            roteiros de pergunta). Também vendida em pacote: 3 por R$ 25 ou 5 por R$ 40. Sem
            mensalidade, sem renovação automática — o crédito comprado não expira.
          </li>
        </ul>
        <p>
          Os pagamentos são processados pelo Asaas (Asaas Gestão Financeira S.A.), que aceita Pix,
          cartão de crédito e boleto. A PrepaVaga não armazena dados de cartão. A nota fiscal é
          emitida pelo próprio Asaas.
        </p>
      </Section>

      <Section number="4." title="Como o crédito funciona">
        <p>
          Cada crédito vale por uma preparação completa. Ele é debitado no momento em que você
          pede a geração — no botão &ldquo;Gerar preparação completa&rdquo; — e não antes: criar a
          preparação, enviar o currículo e rodar a análise ATS não custam crédito.
        </p>
        <p>
          <strong className="text-text-primary">O crédito volta pro seu saldo</strong> em duas
          situações, automaticamente e sem você precisar pedir:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Falha na geração.</strong> Se a preparação não
            for entregue, o crédito é devolvido e você pode tentar de novo ou usá-lo em outra vaga.
          </li>
          <li>
            <strong className="text-text-primary">Entrega parcial.</strong> Se parte das seções não
            for gerada, o crédito também é devolvido — você fica com o que foi gerado e com o
            crédito de volta.
          </li>
        </ul>
        <p>
          O crédito comprado <strong>não expira</strong> e não tem prazo de uso. Ele fica na sua
          conta até você gastar.
        </p>
      </Section>

      <Section number="5." title="Reembolso (garantia de 7 dias)">
        <p>
          Se você comprou crédito de preparação e não ficou satisfeito, pode pedir reembolso
          integral em até <strong>7 dias corridos</strong> a partir do pagamento, mediante
          feedback por voz de 10 minutos com a equipe. Basta escrever para{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:contato@prepavaga.com.br">
            contato@prepavaga.com.br
          </a>{" "}
          dentro do prazo.
        </p>
        <p>
          O reembolso é feito como estorno da cobrança original pelo Asaas, pelo mesmo meio de
          pagamento que você usou. O prazo até o dinheiro aparecer depende do meio (cartão pode
          levar até duas faturas; Pix e boleto são mais rápidos) e é do Asaas e do seu banco, não
          nosso. Os créditos ainda não usados daquela compra saem do seu saldo no momento do
          estorno.
        </p>
        <p>
          Após esse prazo, reembolsos são analisados caso a caso e não são garantidos. A análise
          ATS não é uma compra — por ser sempre gratuita, não há valor a reembolsar por ela.
        </p>
      </Section>

      <Section number="6." title="Como você deve usar">
        <p>Você concorda em <strong className="text-text-primary">não</strong>:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Usar a PrepaVaga para fins ilegais, fraudulentos ou para gerar conteúdo ofensivo.</li>
          <li>
            Tentar burlar limites de quota, criar contas múltiplas para abusar da análise ATS
            gratuita, ou automatizar requisições (scraping, bots).
          </li>
          <li>Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte.</li>
          <li>Compartilhar sua conta com terceiros ou revender o acesso.</li>
          <li>
            Subir currículo ou descrição de vaga que viole direito autoral, segredo comercial ou
            informações sigilosas de terceiros sem autorização.
          </li>
        </ul>
        <p>
          Podemos suspender ou encerrar contas que violem estas regras, com ou sem aviso prévio,
          dependendo da gravidade.
        </p>
      </Section>

      <Section number="7." title="Conteúdo gerado e propriedade intelectual">
        <p>
          O currículo e as informações que você submete continuam sendo seus. Ao usar a PrepaVaga,
          você nos concede licença limitada e revogável para processar esses dados exclusivamente
          para gerar seu dossiê e operar o serviço.
        </p>
        <p>
          O dossiê gerado, incluindo análise ATS, perguntas e roteiros, é seu. Pode imprimir,
          salvar e usar livremente em qualquer entrevista.
        </p>
        <p>
          A marca, logotipo, código-fonte, design e tecnologia da PrepaVaga pertencem à IAgentics
          e estão protegidos por direitos autorais e propriedade intelectual.
        </p>
      </Section>

      <Section number="8." title="Limitações do serviço e da IA">
        <p>
          A PrepaVaga usa modelos de IA generativa (Google Gemini) e pesquisa pública na internet.
          A qualidade do dossiê depende da qualidade do currículo e da descrição da vaga que você
          fornecer.
        </p>
        <p>
          <strong className="text-text-primary">Não garantimos contratação.</strong> A decisão de
          quem entrevista e contrata é sempre da empresa contratante. A PrepaVaga é uma ferramenta
          de preparação, não um intermediador de vagas nem agente de carreira.
        </p>
        <p>
          As pesquisas sobre empresas usam fontes públicas (notícias, sites oficiais, redes sociais
          públicas). Pode haver imprecisões. Verifique antes de usar fatos sensíveis em uma
          entrevista.
        </p>
      </Section>

      <Section number="9." title="Suspensão e encerramento da conta">
        <p>
          Você pode encerrar sua conta a qualquer momento em{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile/account">
            Meu perfil
          </Link>
          . Ao encerrar, seus dados são removidos conforme nossa{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/privacidade">
            Política de Privacidade
          </Link>
          .
        </p>
        <p>
          Podemos encerrar contas que violem estes Termos ou que apresentem atividade fraudulenta
          de pagamento. Nesses casos, créditos comprados e ainda não usados são reembolsados por
          estorno, salvo quando o próprio pagamento for fraudulento.
        </p>
      </Section>

      <Section number="10." title="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, a PrepaVaga e a PROAICIRCLE Ltda não respondem
          por: (i) decisões de contratação tomadas por terceiros; (ii) eventuais imprecisões em
          dados gerados pela IA; (iii) indisponibilidade temporária do serviço por manutenção,
          falha de terceiros (Asaas, Supabase, Google) ou força maior; (iv) danos indiretos,
          lucros cessantes ou perda de oportunidade.
        </p>
        <p>
          Em qualquer hipótese, nossa responsabilidade total fica limitada ao valor pago por você
          nos últimos 12 meses, ou R$ 100, o que for maior.
        </p>
      </Section>

      <Section number="11." title="Alterações nos Termos">
        <p>
          Podemos atualizar estes Termos quando a lei mudar, quando lançarmos novos recursos ou
          quando ajustarmos os planos. Mudanças relevantes são comunicadas por e-mail e/ou aviso na
          plataforma com pelo menos 7 dias de antecedência.
        </p>
        <p>
          Se você continuar usando a PrepaVaga depois da entrada em vigor das mudanças, fica
          entendido que concorda. Se não concordar, pode encerrar a conta.
        </p>
      </Section>

      <Section number="12." title="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o
          Código de Defesa do Consumidor, o Marco Civil da Internet e a Lei Geral de Proteção de
          Dados (LGPD).
        </p>
        <p>
          Fica eleito o <strong className="text-text-primary">Foro Central da Comarca de São
          Paulo/SP</strong> para dirimir eventuais controvérsias, ressalvado o direito do
          consumidor de propor ação em seu próprio domicílio.
        </p>
      </Section>

      <Section number="13." title="Contato">
        <p>
          Dúvidas sobre estes Termos? Escreva pra{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:contato@prepavaga.com.br">
            contato@prepavaga.com.br
          </a>
          . Para questões de privacidade e direitos LGPD, veja a{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/privacidade">
            Política de Privacidade
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
