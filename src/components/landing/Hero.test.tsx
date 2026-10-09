import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Hero } from "./Hero";

// A server action de verdade puxa next/headers, env e o admin client do
// Supabase. O assunto aqui é o que o hero coloca na primeira tela.
vi.mock("@/app/analise-ats-gratis/actions", () => ({
  runAnonAtsAnalysis: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

// O jsdom não implementa play()/pause() e reclama no stderr a cada montagem do
// AutoVideo. Este arquivo testa a estrutura do hero, não o vídeo (isso está em
// AutoVideo.test.tsx).
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: () => Promise.resolve(),
});
Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: () => {},
});

describe("<Hero />", () => {
  it("a ferramenta grátis está logo abaixo do vídeo, não um convite a criar conta", () => {
    const { getByLabelText, getByRole } = render(<Hero />);

    expect(getByLabelText(/cole a descrição da vaga/i)).toBeTruthy();
    expect(getByLabelText(/envie seu currículo/i)).toBeTruthy();
    expect(
      getByRole("button", { name: /analisar meu currículo grátis/i }),
    ).toBeTruthy();
  });

  it("não manda ninguém pro cadastro antes de entregar o score", () => {
    // Regressão do funil invertido: o hero anterior tinha o /signup como CTA
    // primário e escondia a análise grátis como terceiro link em texto
    // pequeno. Cadastro na primeira tela é a fricção que essa mudança tirou.
    const { container } = render(<Hero />);

    expect(container.querySelector('a[href="/signup"]')).toBeNull();
  });

  it("só dois CTAs: o botão pra ferramenta e o exemplo pronto", () => {
    // O vídeo em tela cheia empurra o formulário pra baixo da dobra no desktop;
    // o CTA sobre ele leva direto ao formulário. O exemplo continua sendo o
    // único outro caminho — e nenhum dos dois vai pro cadastro.
    const { container } = render(<Hero />);

    // Os links da política de privacidade e da LGPD (linha de confiança) não são
    // CTAs: o que importa é que nenhum CTA leve ao cadastro.
    const hrefs = Array.from(container.querySelectorAll("a"))
      .map((a) => a.getAttribute("href"))
      .filter((h) => h !== "/privacidade" && h !== "/lgpd");
    expect(hrefs.sort()).toEqual(["#analisar", "/exemplo"]);
  });

  it("a manchete não promete apenas o que a concorrência já dá de graça", () => {
    // Pelo menos 5 concorrentes brasileiros diretos (AjustaCV, OtimizaCV, CV
    // Audit, CvPorVaga, CV Lab) vendem "seu currículo passa no ATS?" — e dois
    // entregam mais de graça ou cobram menos. Manchete de commodity não dá a
    // quem compara nenhum motivo pra escolher a PrepaVaga.
    const { getByRole } = render(<Hero />);

    expect(getByRole("heading", { level: 1 }).textContent).toMatch(/entrevista/i);
  });

  it("o que vem DEPOIS do currículo está na transcrição do vídeo de instruções", () => {
    // Pesquisa da empresa, perguntas prováveis e faixa salarial são o que
    // nenhum analisador de CV concorrente entrega. O texto explicativo saiu do
    // hero a pedido (o vídeo explica), então esse conteúdo vive na descrição
    // do vídeo — que o leitor de tela lê, mas quem enxerga e não dá play NÃO
    // vê. Se isso importar de novo, o lugar é um texto visível, não este teste.
    const { container } = render(<Hero />);
    const legendas = Array.from(container.querySelectorAll("figcaption")).map((f) => f.textContent ?? "");
    const howto = legendas.find((t) => /instruções/i.test(t)) ?? "";

    expect(howto).toMatch(/empresa/i);
    expect(howto).toMatch(/pergunta/i);
    expect(howto).toMatch(/salarial/i);
  });

  it("as descrições citam os preços de PREP_SKUS, não números escritos à mão", () => {
    const { container } = render(<Hero />);
    const texto = container.textContent ?? "";

    expect(texto).toMatch(/1 por R\$10, 3 por R\$25, 5 por R\$40/);
  });

  it("o grátis e o sem cadastro continuam à vista junto do formulário", () => {
    // A ferramenta converte 20 de 21 visitantes (amostra pequena). O texto em
    // volta dela saiu, mas o próprio card diz "grátis" e "sem cadastro".
    const { container } = render(<Hero />);
    const texto = container.textContent ?? "";

    expect(texto).toMatch(/grátis/i);
    expect(texto).toMatch(/sem cadastro/i);
  });

  it("no DOM: vídeo promocional, formulário, vídeo de instruções (celular)", () => {
    // O comentário do Hero registra que headline longa já empurrou o primeiro
    // campo pra fora da dobra no celular. O vídeo de instruções não pode
    // repetir isso: no celular o formulário vem ANTES dele.
    const { container } = render(<Hero />);
    const [promo, instrucoes] = Array.from(container.querySelectorAll("video"));
    const form = container.querySelector("form")!;
    const depois = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(promo.getAttribute("src")).toBe("/video/hero-v1.mp4");
    expect(instrucoes.getAttribute("src")).toBe("/video/howto-v1.mp4");
    expect(depois(promo, form)).toBe(true);
    expect(depois(form, instrucoes)).toBe(true);
  });

  it("a promessa está em texto VISÍVEL na primeira tela, não só dentro do vídeo", () => {
    // Quem não dá play (reduced motion, economia de dados, iOS) vê o poster e
    // a barra. Sem esta barra a primeira tela não diria o que a PrepaVaga faz.
    const { container, getByRole } = render(<Hero />);
    const h1 = getByRole("heading", { level: 1 });
    expect(h1.className).not.toContain("sr-only");

    const barra = container.querySelector('section[aria-label="Apresentação"] p')!;
    expect(barra.textContent).toMatch(/grátis/i);
    expect(barra.textContent).toMatch(/sem cadastro/i);
    expect(barra.textContent).toMatch(/empresa/i);
    expect(barra.textContent).toMatch(/pergunta/i);
    expect(barra.textContent).toMatch(/salarial/i);
    expect(barra.textContent).toContain("R$10");
  });

  it("a seção da ferramenta mantém o id que a navbar e o CTA fixo do celular usam", () => {
    const { container } = render(<Hero />);
    expect(container.querySelector("section#analisar")).toBeTruthy();
  });

  it("a faixa de fontes vem entre o vídeo e a ferramenta, e a linha de confiança depois do formulário", () => {
    const { container } = render(<Hero />);
    const depois = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const promo = container.querySelector("video")!;
    const faixa = container.querySelector('section[aria-label="De onde copiar a vaga"]')!;
    const form = container.querySelector("form")!;
    const confianca = container.querySelector('ul[aria-label="Como tratamos o seu currículo"]')!;

    expect(depois(promo, faixa)).toBe(true);
    expect(depois(faixa, form)).toBe(true);
    expect(depois(form, confianca)).toBe(true);
  });
});
