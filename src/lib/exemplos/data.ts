/**
 * Exemplos de preparação por cargo, para a galeria /exemplo.
 *
 * TUDO aqui é fictício: empresas, vagas, números e faixas salariais são
 * ilustrativos e a página diz isso. Nunca colocar aqui a preparação de um
 * usuário real (privacidade/LGPD). Os números dentro dos roteiros existem pra
 * mostrar COMO escrever um resultado, não como dado de mercado.
 */

export type Nivel = "Crítico" | "Alto" | "Médio";
export type CorPergunta = "orange" | "yellow" | "green";

export type ItemAts = {
  nivel: Nivel;
  /** Marque termos em destaque com **dois asteriscos**. */
  texto: string;
};

export type PerguntaExemplo = {
  tipo: string;
  cor: CorPergunta;
  pergunta: string;
  /** "Roteiro" para as perguntas que o candidato responde; "Por que funciona" para as que ele faz. */
  rotulo: "Roteiro" | "Por que funciona";
  texto: string;
};

export type Exemplo = {
  slug: string;
  /** Rótulo curto para a navegação por cargo. */
  area: string;
  cargo: string;
  empresa: string;
  /** Segmento · cidade (regime). */
  contexto: string;
  pesquisa: string;
  salario: { faixa: string; detalhe: string };
  score: number;
  ats: ItemAts[];
  perguntas: PerguntaExemplo[];
  /** Slug do artigo de cargo que aprofunda esta área, quando existir. */
  artigo?: string;
};

export const EXEMPLO_PRINCIPAL: Exemplo = {
  slug: "",
  area: "Marketing",
  cargo: "Analista de Marketing Pleno",
  empresa: "Maré",
  contexto: "e-commerce de moda · São Paulo (híbrido)",
  pesquisa:
    "Cresceu 3× no último ano e acabou de abrir operação de marketplace. O desafio público do time de growth: CAC subindo com a concorrência de mídia paga — a vaga provavelmente existe pra diversificar canais.",
  salario: {
    faixa: "R$ 4.800 – 6.900",
    detalhe: "mediana R$ 5.700 · pleno · região de SP",
  },
  score: 68,
  ats: [
    {
      nivel: "Crítico",
      texto:
        "A vaga pede **Google Analytics 4** e **CRM** — nenhum dos dois aparece no CV, embora a experiência descrita sugira que você usou ambos.",
    },
    {
      nivel: "Alto",
      texto:
        "Experiências sem números. “Gerenciei campanhas de mídia paga” → “Gerenciei R$ 40 mil/mês em Meta e Google Ads, reduzindo o CAC em 18%”.",
    },
    {
      nivel: "Médio",
      texto:
        "Título do CV genérico (“Profissional de Marketing”) — o ATS busca o cargo da vaga. Troque por “Analista de Marketing Pleno”.",
    },
  ],
  perguntas: [
    {
      tipo: "Provável · básica",
      cor: "orange",
      pergunta: "“Por que você quer trabalhar na Maré?”",
      rotulo: "Roteiro",
      texto:
        "conecte a expansão pro marketplace (da pesquisa acima) com sua experiência: “Vi que vocês abriram marketplace este ano — já operei aquisição num momento parecido e sei o que muda no funil quando o sortimento explode. É exatamente o problema que quero resolver.”",
    },
    {
      tipo: "Aprofundamento",
      cor: "yellow",
      pergunta:
        "“Conte uma campanha que não deu certo. O que você faria diferente?”",
      rotulo: "Roteiro",
      texto:
        "estrutura em 3 passos — contexto e hipótese, o que os dados mostraram, a mudança que você aplicou depois. O erro fatal aqui é culpar orçamento ou terceiros; a banca quer ver dono do problema.",
    },
    {
      tipo: "Você pergunta",
      cor: "green",
      pergunta:
        "“Como o time mede sucesso dessa posição nos primeiros 90 dias?”",
      rotulo: "Por que funciona",
      texto:
        "mostra que você pensa em resultado antes mesmo de entrar — e a resposta te diz se a expectativa da empresa é realista.",
    },
  ],
};

export const EXEMPLOS: Exemplo[] = [
  {
    slug: "gerente-de-loja",
    area: "Gerente de loja",
    cargo: "Gerente de Loja de Supermercado",
    empresa: "Rede Horizonte",
    contexto: "supermercados · interior do RS",
    pesquisa:
      "Rede regional que abriu duas lojas no último ano e tenta padronizar a operação entre elas. O desafio provável: perda em perecíveis e rotatividade de equipe nas lojas novas — a vaga existe pra dar consistência à operação, não só pra tocar uma loja.",
    salario: {
      faixa: "R$ 7.500 – 12.000",
      detalhe: "mediana R$ 9.200 · gerência · interior do RS",
    },
    score: 54,
    ats: [
      {
        nivel: "Crítico",
        texto:
          "A vaga pede **gestão de perdas** e **DRE da loja**. O CV fala em “controle de estoque” e “resultados da loja”, termos que o ATS não liga a esses.",
      },
      {
        nivel: "Alto",
        texto:
          "Liderança sem escopo. “Liderei equipe de loja” → “Liderei 85 colaboradores em 3 turnos, com meta mensal de faturamento e redução de quebra em perecíveis”.",
      },
      {
        nivel: "Médio",
        texto:
          "Título genérico (“Profissional de varejo”). A vaga é de **Gerente de Loja**: use o cargo exato no topo do CV e na experiência atual.",
      },
    ],
    perguntas: [
      {
        tipo: "Provável · básica",
        cor: "orange",
        pergunta:
          "“Como você reduziria a perda de perecíveis nas primeiras semanas na loja?”",
        rotulo: "Roteiro",
        texto:
          "comece pelo diagnóstico, não pela solução: “Olho onde a perda se concentra — recebimento, exposição ou validade — e só então mexo no processo. Já reduzi quebra revisando a rotina de rodízio e o pedido de reposição.” Mostre método antes de prometer resultado.",
      },
      {
        tipo: "Aprofundamento",
        cor: "yellow",
        pergunta:
          "“Conte uma vez em que você perdeu um bom colaborador. O que mudou depois?”",
        rotulo: "Roteiro",
        texto:
          "assuma a sua parte. Estrutura: o que aconteceu, o que você percebeu tarde, o que passou a fazer (conversa individual regular, plano de carreira interno). Culpar salário ou escala soa como fuga; a banca quer ver aprendizado de gestão.",
      },
      {
        tipo: "Você pergunta",
        cor: "green",
        pergunta:
          "“Qual é o indicador da loja que a diretoria acompanha toda semana?”",
        rotulo: "Por que funciona",
        texto:
          "mostra que você já pensa no que será cobrado, e a resposta revela se a empresa gerencia por perda, por venda ou por margem — o que muda como você vai priorizar o dia.",
      },
    ],
    artigo: "curriculo-de-gerente-ats",
  },
  {
    slug: "contador",
    area: "Contabilidade",
    cargo: "Analista Contábil Pleno",
    empresa: "Grupo Âncora",
    contexto: "indústria de embalagens · Curitiba (híbrido)",
    pesquisa:
      "Indústria média em expansão que passou a atender o mercado externo e incorporou uma unidade nova. O fechamento mensal tende a ter virado gargalo — a vaga provavelmente existe pra encurtar o fechamento e organizar as obrigações acessórias do grupo.",
    salario: {
      faixa: "R$ 5.200 – 7.800",
      detalhe: "mediana R$ 6.300 · pleno · região de Curitiba",
    },
    score: 61,
    ats: [
      {
        nivel: "Crítico",
        texto:
          "A vaga pede **conciliação contábil** e **SPED Contribuições**. O CV só diz “rotinas fiscais e contábeis”, que não bate com nenhum dos dois termos.",
      },
      {
        nivel: "Alto",
        texto:
          "Sistema sem nome. “Utilizei sistema contábil” → “Realizei o fechamento mensal no TOTVS Protheus, conciliando as contas de 3 empresas do grupo”.",
      },
      {
        nivel: "Médio",
        texto:
          "O registro profissional fica no rodapé. Coloque **CRC** com o número logo abaixo do nome — vaga contábil costuma filtrar por isso.",
      },
    ],
    perguntas: [
      {
        tipo: "Provável · básica",
        cor: "orange",
        pergunta: "“Como funciona o seu processo de fechamento mensal?”",
        rotulo: "Roteiro",
        texto:
          "conte em ordem, com os prazos que você cumpre: “Concilio bancos e contas de balanço até o dia X, valido a folha e os impostos, reviso a DRE por variação e só então libero o fechamento.” Citar o sistema e a ordem mostra que o processo é seu, não de equipe.",
      },
      {
        tipo: "Aprofundamento",
        cor: "yellow",
        pergunta:
          "“Descreva um erro que você encontrou depois do fechamento. O que fez?”",
        rotulo: "Roteiro",
        texto:
          "banca de contabilidade quer controle, não perfeição: o que você detectou, como corrigiu sem distorcer o período anterior, e o que passou a conferir antes de fechar. Esconder o erro é o que reprova.",
      },
      {
        tipo: "Você pergunta",
        cor: "green",
        pergunta:
          "“Em que ponto do fechamento o time costuma perder mais tempo hoje?”",
        rotulo: "Por que funciona",
        texto:
          "mostra que você foi contratado pra resolver gargalo e não só pra lançar. A resposta também diz se o problema é sistema, prazo de outras áreas ou falta de processo.",
      },
    ],
    artigo: "curriculo-de-contador-ats",
  },
  {
    slug: "designer",
    area: "Design",
    cargo: "Product Designer Pleno",
    empresa: "Trilha",
    contexto: "fintech · remoto",
    pesquisa:
      "Fintech em fase de crescimento que está consolidando o design system entre o app e o site. O sinal público é a dor de consistência entre produtos — a vaga provavelmente existe pra sustentar o sistema e reduzir retrabalho entre times.",
    salario: {
      faixa: "R$ 6.500 – 10.500",
      detalhe: "mediana R$ 8.000 · pleno · remoto no Brasil",
    },
    score: 66,
    ats: [
      {
        nivel: "Crítico",
        texto:
          "A vaga pede **Figma**, **design system** e **pesquisa com usuários**. O CV está em duas colunas com ícones, e o ATS leu a lista de habilidades fora de ordem.",
      },
      {
        nivel: "Alto",
        texto:
          "Projeto sem resultado. “Redesenhei o app” → “Redesenhei o fluxo de abertura de conta e reduzi a desistência na etapa de documentos”.",
      },
      {
        nivel: "Médio",
        texto:
          "O portfólio aparece só como imagem. Coloque o **link em texto** no topo do CV; o ATS lê o texto, não o logotipo.",
      },
    ],
    perguntas: [
      {
        tipo: "Provável · básica",
        cor: "orange",
        pergunta: "“Conte um projeto do portfólio do começo ao fim.”",
        rotulo: "Roteiro",
        texto:
          "problema, o que você descobriu com usuários, as decisões que tomou e por quê, e o que mudou depois. Evite começar pela tela final; a banca quer ver o raciocínio, e o resultado vem no fim.",
      },
      {
        tipo: "Aprofundamento",
        cor: "yellow",
        pergunta:
          "“Um desenvolvedor diz que o seu design é inviável de implementar. Como você reage?”",
        rotulo: "Roteiro",
        texto:
          "mostre colaboração, não defesa: perguntar qual é a restrição real, propor uma versão que preserve a intenção do fluxo e combinar o que fica pra depois. Quem responde “o design está certo” perde pontos.",
      },
      {
        tipo: "Você pergunta",
        cor: "green",
        pergunta:
          "“Como o design system é mantido hoje, e quem decide quando um componente muda?”",
        rotulo: "Por que funciona",
        texto:
          "mostra que você pensa em sistema e não só em tela, e revela se o time tem governança ou se você vai herdar um sistema sem dono.",
      },
    ],
    artigo: "curriculo-de-designer-ats",
  },
  {
    slug: "compras",
    area: "Compras",
    cargo: "Analista de Compras Sênior",
    empresa: "Metalúrgica Aurora",
    contexto: "indústria · Joinville (presencial)",
    pesquisa:
      "Metalúrgica de porte médio que depende de poucos fornecedores de matéria-prima e sente a volatilidade de preço. A vaga provavelmente existe pra ampliar a base de fornecedores e profissionalizar a negociação, hoje mais reativa do que planejada.",
    salario: {
      faixa: "R$ 6.800 – 9.600",
      detalhe: "mediana R$ 7.900 · sênior · região de Joinville",
    },
    score: 58,
    ats: [
      {
        nivel: "Crítico",
        texto:
          "A vaga pede **negociação com fornecedores**, **RFQ** e **SAP MM**. O CV diz apenas “compras de materiais”, sem nenhum desses termos.",
      },
      {
        nivel: "Alto",
        texto:
          "Economia sem base de comparação. “Gerei economia nas compras” → “Renegociei contratos de embalagens e gerei saving de 8% sobre o preço anterior”.",
      },
      {
        nivel: "Médio",
        texto:
          "O cargo atual aparece como “Comprador”, mas a vaga é de **Analista de Compras Sênior**. Use o termo da vaga, se o escopo for equivalente.",
      },
    ],
    perguntas: [
      {
        tipo: "Provável · básica",
        cor: "orange",
        pergunta: "“Como você conduz uma negociação com um fornecedor crítico?”",
        rotulo: "Roteiro",
        texto:
          "prepare antes de sentar: alternativas de fornecimento, histórico de preço e o que o fornecedor ganha em fechar. “Nunca negocio só preço; olho prazo, volume e risco de abastecimento.” Mostre que você tem plano B.",
      },
      {
        tipo: "Aprofundamento",
        cor: "yellow",
        pergunta:
          "“O fornecedor principal avisa que vai subir o preço 15%. O que você faz?”",
        rotulo: "Roteiro",
        texto:
          "diagnóstico antes de reação: o aumento é de custo ou de poder de barganha? Depois cotar alternativas, antecipar compra se fizer sentido e renegociar contrapartidas. A banca quer ver que você não aceita nem briga por reflexo.",
      },
      {
        tipo: "Você pergunta",
        cor: "green",
        pergunta:
          "“Qual parcela das compras está concentrada em poucos fornecedores hoje?”",
        rotulo: "Por que funciona",
        texto:
          "vai direto ao risco que a vaga existe para resolver, e a resposta mostra se você terá mandato pra abrir fornecedor novo ou só pra renegociar os atuais.",
      },
    ],
    artigo: "curriculo-de-compras-suprimentos-ats",
  },
];

export function getExemplo(slug: string): Exemplo | undefined {
  return EXEMPLOS.find((e) => e.slug === slug);
}
