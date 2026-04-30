import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout, Section } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como a PrepaVaga coleta, usa, compartilha e protege seus dados pessoais. Em conformidade com a LGPD (Lei Geral de Proteção de Dados).",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="26 de abril de 2026">
      <p className="text-lg text-text-primary">
        Sua privacidade importa. Esta política descreve, em linguagem direta, quais dados pessoais
        a PrepaVaga coleta, por que, com quem compartilha e como você pode exercer seus direitos
        conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).
      </p>

      <Section number="1." title="Quem é o controlador dos seus dados">
        <p>
          A controladora dos dados pessoais coletados pela PrepaVaga é a{" "}
          <strong className="text-text-primary">PROAICIRCLE CONSULTORIA EMPRESARIAL LTDA</strong>
          {" "}(nome fantasia: <em>Pro AI Circle</em>), CNPJ{" "}
          <strong className="text-text-primary">62.805.016/0001-29</strong>, com sede na Rua Pais
          Leme, 215, Conjunto 1713, Pinheiros, São Paulo/SP, CEP 05.424-150.
        </p>
        <p>
          Para exercer seus direitos LGPD ou tirar dúvidas sobre privacidade, fale com nosso
          encarregado pela proteção de dados (DPO):{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:privacidade@prepavaga.com.br">
            privacidade@prepavaga.com.br
          </a>
          .
        </p>
      </Section>

      <Section number="2." title="Quais dados coletamos">
        <p>Coletamos só o necessário pra entregar o serviço:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Cadastro:</strong> nome completo, e-mail, senha
            (armazenada com hash, nunca em texto puro), CPF ou CNPJ, foto de perfil (opcional).
          </li>
          <li>
            <strong className="text-text-primary">Conteúdo enviado:</strong> currículo (PDF, DOCX
            ou texto), descrição da vaga (texto colado ou link da vaga).
          </li>
          <li>
            <strong className="text-text-primary">Dados de uso:</strong> preps gerados, status de
            geração, créditos, data de cadastro e de último uso.
          </li>
          <li>
            <strong className="text-text-primary">Pagamento:</strong> os dados de cartão e Pix são
            tratados diretamente pelo Asaas. A PrepaVaga armazena apenas o ID do cliente Asaas, o
            ID da assinatura e o histórico de transações (data, valor, status). Não temos acesso
            ao número do seu cartão.
          </li>
          <li>
            <strong className="text-text-primary">Cookies e técnicas similares:</strong> usamos
            apenas cookies essenciais para autenticação e sessão. Não usamos cookies de
            rastreamento publicitário.
          </li>
        </ul>
        <p>
          Não coletamos dados sensíveis (saúde, opinião política, biometria, orientação sexual,
          etc.) nem dados de menores de 18 anos.
        </p>
      </Section>

      <Section number="3." title="Por que coletamos (finalidades e bases legais)">
        <p>Cada dado tem um propósito claro e uma base legal LGPD correspondente:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Operar o serviço.</strong> Processar seu CV e a
            vaga para gerar o dossiê. Base: execução do contrato (art. 7º, V).
          </li>
          <li>
            <strong className="text-text-primary">Autenticar você.</strong> Login seguro,
            recuperação de senha. Base: execução do contrato.
          </li>
          <li>
            <strong className="text-text-primary">Cobrar pagamentos.</strong> Emitir cobranças via
            Asaas, manter histórico fiscal. Base: execução do contrato e cumprimento de obrigação
            legal/regulatória (art. 7º, II e V).
          </li>
          <li>
            <strong className="text-text-primary">Melhorar a plataforma.</strong> Métricas
            agregadas e anonimizadas de uso. Base: legítimo interesse (art. 7º, IX).
          </li>
          <li>
            <strong className="text-text-primary">Comunicação transacional.</strong> E-mails de
            confirmação, recibos, alertas de quota. Base: execução do contrato.
          </li>
        </ul>
        <p>
          <strong className="text-text-primary">Não treinamos modelos de IA com seus dados.</strong>{" "}
          Seu CV e suas descrições de vaga não alimentam o treinamento dos modelos do Google nem da
          OpenAI nem de qualquer terceiro.
        </p>
      </Section>

      <Section number="4." title="Com quem compartilhamos">
        <p>
          Não vendemos seus dados. Compartilhamos apenas com fornecedores que ajudam a operar o
          serviço, sob contrato e com obrigações de proteção de dados:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-text-primary">Supabase</strong> (hospedagem do banco de dados,
            armazenamento de arquivos, autenticação). Servidores nos Estados Unidos.
          </li>
          <li>
            <strong className="text-text-primary">Google (Gemini API)</strong>, processador de IA
            para gerar dossiês, análise ATS, reescrita de CV e pesquisa sobre empresas. As
            requisições não são usadas para treinamento. Servidores nos Estados Unidos.
          </li>
          <li>
            <strong className="text-text-primary">Asaas Gestão Financeira S.A.</strong> (Brasil),
            para processar todas as cobranças. O Asaas tem sua própria política de privacidade.
          </li>
          <li>
            <strong className="text-text-primary">Railway</strong> (hospedagem da aplicação web).
            Servidores nos Estados Unidos.
          </li>
          <li>
            <strong className="text-text-primary">Jina Reader</strong> (extração de texto quando
            você cola um link de vaga). Apenas a URL é enviada, não dados pessoais seus.
          </li>
        </ul>
        <p>
          Também podemos compartilhar dados quando obrigados por ordem judicial, requisição de
          autoridade competente, ou para defender direitos da PrepaVaga em processos legais.
        </p>
      </Section>

      <Section number="5." title="Transferência internacional de dados">
        <p>
          Como Supabase, Google e Railway operam fora do Brasil, alguns dos seus dados são
          transferidos para os Estados Unidos. Conforme o art. 33 da LGPD, essa transferência é
          feita com base em (i) cláusulas contratuais padrão de proteção de dados firmadas com
          esses fornecedores e (ii) seu consentimento ao aceitar esta política no momento do
          cadastro.
        </p>
      </Section>

      <Section number="6." title="Por quanto tempo guardamos">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Quando você apaga a conta:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Currículos, vagas, dossiês e dados de perfil são removidos em até 30 dias.
          </li>
          <li>
            Histórico de pagamentos e dados fiscais são mantidos pelo prazo legal mínimo (5 anos)
            por exigência da legislação tributária.
          </li>
          <li>
            Logs técnicos anonimizados (sem identificação) podem ser mantidos para segurança e
            auditoria.
          </li>
        </ul>
      </Section>

      <Section number="7." title="Seus direitos como titular (art. 18 da LGPD)">
        <p>Você pode, a qualquer momento, exigir:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Confirmação se tratamos seus dados.</li>
          <li>Acesso aos dados que temos sobre você.</li>
          <li>Correção de dados incompletos ou desatualizados.</li>
          <li>
            Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo
            com a LGPD.
          </li>
          <li>Portabilidade dos dados a outro fornecedor de serviço similar.</li>
          <li>Eliminação dos dados tratados com base no seu consentimento.</li>
          <li>Informação sobre com quem compartilhamos seus dados.</li>
          <li>Revogação do consentimento, quando aplicável.</li>
        </ul>
        <p>
          Para exercer qualquer direito, escreva pra{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:privacidade@prepavaga.com.br">
            privacidade@prepavaga.com.br
          </a>
          . Respondemos em até 15 dias.
        </p>
        <p>
          Você pode também: deletar sua conta a qualquer momento em{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile/account">
            Meu perfil
          </Link>
          ; baixar seu CV original em{" "}
          <Link className="text-brand-600 underline-offset-4 hover:underline" href="/profile/cvs">
            Perfil &gt; CVs
          </Link>
          .
        </p>
      </Section>

      <Section number="8." title="Como protegemos seus dados">
        <p>
          Aplicamos medidas técnicas e organizacionais razoáveis para proteger seus dados:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Criptografia em trânsito (HTTPS/TLS) e em repouso (Supabase).</li>
          <li>
            Row-Level Security no banco: cada usuário só consegue ler os próprios dados, mesmo via
            API direta.
          </li>
          <li>Senhas armazenadas com hash forte (Argon2/bcrypt via Supabase Auth).</li>
          <li>Controle de acesso aos sistemas internos restrito a pessoas autorizadas.</li>
          <li>Monitoramento contínuo de tentativas de acesso suspeito.</li>
        </ul>
        <p>
          Apesar desses cuidados, nenhum sistema é 100% imune. Em caso de incidente de segurança
          que afete seus dados, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e
          você diretamente, conforme exigido pela LGPD.
        </p>
      </Section>

      <Section number="9." title="Cookies">
        <p>Usamos apenas cookies essenciais:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>Cookie de sessão (Supabase Auth) para manter você logado.</li>
          <li>Preferência de tema (claro/escuro) salva localmente no navegador.</li>
        </ul>
        <p>
          Não usamos cookies de rastreamento publicitário, third-party analytics invasivos, nem
          pixels de remarketing.
        </p>
      </Section>

      <Section number="10." title="Crianças e adolescentes">
        <p>
          A PrepaVaga é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de
          crianças ou adolescentes. Se identificarmos que uma conta foi criada por menor, ela será
          encerrada e os dados removidos.
        </p>
      </Section>

      <Section number="11." title="Mudanças nesta política">
        <p>
          Podemos atualizar esta política para refletir mudanças no serviço, na lei ou nas práticas
          de privacidade. Mudanças relevantes serão comunicadas por e-mail com pelo menos 7 dias de
          antecedência. Versões anteriores ficam disponíveis sob solicitação.
        </p>
      </Section>

      <Section number="12." title="Contato">
        <p>
          Encarregado de Proteção de Dados (DPO):{" "}
          <a className="text-brand-600 underline-offset-4 hover:underline" href="mailto:privacidade@prepavaga.com.br">
            privacidade@prepavaga.com.br
          </a>
          .
        </p>
        <p>
          Você também pode registrar reclamação diretamente na Autoridade Nacional de Proteção de
          Dados (ANPD) em{" "}
          <a
            className="text-brand-600 underline-offset-4 hover:underline"
            href="https://www.gov.br/anpd"
            target="_blank"
            rel="noopener noreferrer"
          >
            gov.br/anpd
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
