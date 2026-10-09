import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnonAtsForm } from "./AnonAtsForm";

// A server action de verdade puxa next/headers, env e o admin client do
// Supabase — nada disso é o assunto deste teste, que é o comportamento do
// formulário no navegador.
vi.mock("@/app/analise-ats-gratis/actions", () => ({
  runAnonAtsAnalysis: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));
vi.mock("@/app/analise-ats-gratis/jd-actions", () => ({
  fetchJdFromUrlAnon: vi.fn(),
}));

import { runAnonAtsAnalysis } from "@/app/analise-ats-gratis/actions";
import { fetchJdFromUrlAnon } from "@/app/analise-ats-gratis/jd-actions";
import { track } from "@/lib/analytics/client";

function bigFile() {
  // 6 MB > MAX_UPLOAD_BYTES (5 MB). File real com conteúdo de 6 MB deixaria o
  // teste lento à toa; o tamanho é o que a validação lê.
  const file = new File(["x"], "curriculo.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
  return file;
}

describe("<AnonAtsForm />", () => {
  it("avisa e descarta o arquivo acima do limite", () => {
    const { getByLabelText, getByRole } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [bigFile()] } });

    const alerta = getByRole("alert");
    expect(alerta.textContent).toMatch(/6\.0 MB/);
    expect(alerta.textContent).toMatch(/não foi anexado/i);
  });

  it("mantém o envio habilitado — o texto colado é a saída oferecida", () => {
    // Regressão do botão morto: antes o submit era desabilitado enquanto
    // houvesse um arquivo grande selecionado, e como não há como
    // desselecionar um <input type="file">, colar o texto (a alternativa que
    // a própria mensagem oferece) não devolvia o botão. A única saída era
    // escolher outro arquivo.
    const { getByLabelText, getByRole } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [bigFile()] } });

    const botao = getByRole("button", { name: /analisar meu currículo/i });
    expect(botao).not.toHaveAttribute("disabled");
  });

  it("some com o aviso do arquivo quando o texto é colado", () => {
    const { getByLabelText, queryByRole } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile()] } });
    expect(queryByRole("alert")).not.toBeNull();

    fireEvent.change(getByLabelText(/cole o texto do seu currículo/i), {
      target: { value: "Experiência profissional relevante e detalhada." },
    });

    expect(queryByRole("alert")).toBeNull();
  });

  it("mostra o nome do arquivo escolhido em português", () => {
    // O controle nativo do <input type="file"> desenha "Choose File / No file
    // chosen" com o texto do sistema operacional, em inglês, e não há CSS que
    // troque isso. O input fica sr-only e o nome é renderizado por nós.
    const { getByLabelText, getByText, queryByText } = render(<AnonAtsForm />);
    expect(getByText("Nenhum arquivo escolhido")).toBeTruthy();

    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;
    const ok = new File(["x"], "curriculo-joana.pdf", { type: "application/pdf" });
    Object.defineProperty(ok, "size", { value: 2048 });
    fireEvent.change(input, { target: { files: [ok] } });

    expect(getByText("curriculo-joana.pdf")).toBeTruthy();
    expect(queryByText("Nenhum arquivo escolhido")).toBeNull();
  });

  it("esquece o nome do arquivo que foi descartado por tamanho", () => {
    const { getByLabelText, getByText } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [bigFile()] } });

    // O arquivo não foi anexado, então anunciar o nome dele seria mentira.
    expect(getByText("Nenhum arquivo escolhido")).toBeTruthy();
  });

  it("não reclama de arquivo dentro do limite", () => {
    const { getByLabelText, queryByRole } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;
    const ok = new File(["x"], "cv.pdf", { type: "application/pdf" });
    Object.defineProperty(ok, "size", { value: 1024 });

    fireEvent.change(input, { target: { files: [ok] } });

    expect(queryByRole("alert")).toBeNull();
  });
});

describe("<AnonAtsForm /> — vaga por link", () => {
  const buscarMock = vi.mocked(fetchJdFromUrlAnon);
  const textoDaVaga = () => screen.getByLabelText(/cole a descrição da vaga/i) as HTMLTextAreaElement;
  const abaLink = () => screen.getByRole("tab", { name: /colar link da vaga/i });

  function limpar() {
    buscarMock.mockReset();
    vi.mocked(track).mockClear();
    vi.mocked(runAnonAtsAnalysis).mockClear();
  }

  it("começa no texto; a aba de link troca o campo da vaga por um campo de link", () => {
    limpar();
    render(<AnonAtsForm />);
    expect(screen.getByRole("tab", { name: /colar texto/i })).toHaveAttribute("aria-selected", "true");
    expect(textoDaVaga()).toBeVisible();
    expect(screen.queryByLabelText(/link da vaga/i)).toBeNull();

    fireEvent.click(abaLink());
    expect(screen.getByLabelText(/link da vaga/i)).toBeInTheDocument();
    expect(textoDaVaga()).not.toBeVisible();
    // sem `required` escondido: um campo obrigatório que o navegador não
    // consegue focar bloquearia o envio com um erro mudo
    expect(textoDaVaga()).not.toBeRequired();
  });

  it("avisa que LinkedIn costuma não abrir e manda copiar o texto", () => {
    limpar();
    render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    expect(screen.getByText(/linkedin, costumam não abrir/i)).toBeInTheDocument();
  });

  it("busca com sucesso: o texto vai pro CAMPO DE REVISÃO, não direto pra análise", async () => {
    limpar();
    buscarMock.mockResolvedValue({ ok: true, text: "Requisitos: Excel. Responsabilidades: conciliação.", host: "catho.com.br" });
    render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    fireEvent.change(screen.getByLabelText(/link da vaga/i), { target: { value: "https://www.catho.com.br/vagas/x/1/" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /buscar vaga/i })); });

    await waitFor(() => expect(textoDaVaga().value).toMatch(/Requisitos: Excel/));
    expect(screen.getByRole("tab", { name: /colar texto/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/importamos o texto de catho\.com\.br/i);
    expect(screen.getByRole("status")).toHaveTextContent(/confira se é a vaga certa/i);
    expect(runAnonAtsAnalysis).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("jd_link_fetch", { ok: true, host: "catho.com.br" });
  });

  it("falha: mostra o erro do servidor, continua no modo link e registra o motivo e só o domínio", async () => {
    limpar();
    buscarMock.mockResolvedValue({ ok: false, motivo: "nao_parece_vaga", error: "Essa página não parece trazer a descrição da vaga. Copie o texto." });
    render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    fireEvent.change(screen.getByLabelText(/link da vaga/i), { target: { value: "https://www.positivo.gupy.io/jobs/123?token=segredo" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /buscar vaga/i })); });

    expect(await screen.findByRole("alert")).toHaveTextContent(/não parece trazer a descrição/i);
    // depois da resposta o botão volta a "Buscar vaga" e o campo volta a aceitar digitação
    await waitFor(() => expect(screen.getByRole("button", { name: /buscar vaga/i })).toBeEnabled());
    expect(screen.queryByRole("button", { name: /buscando/i })).toBeNull();
    expect(screen.getByLabelText(/link da vaga/i)).toBeEnabled();
    expect(screen.getByLabelText(/link da vaga/i)).toBeInTheDocument();
    expect(textoDaVaga().value).toBe("");
    // o evento leva o domínio, nunca o caminho nem os parâmetros
    expect(track).toHaveBeenCalledWith("jd_link_fetch", { ok: false, motivo: "nao_parece_vaga", host: "positivo.gupy.io" });
  });

  it("Enter no campo de link busca a vaga e NÃO envia o formulário", async () => {
    limpar();
    buscarMock.mockResolvedValue({ ok: true, text: "Requisitos: Excel. Responsabilidades: conciliação.", host: "x.com" });
    render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    const campo = screen.getByLabelText(/link da vaga/i);
    fireEvent.change(campo, { target: { value: "https://x.com/vaga" } });
    await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });

    expect(buscarMock).toHaveBeenCalledTimes(1);
    expect(buscarMock).toHaveBeenCalledWith("https://x.com/vaga");
    expect(runAnonAtsAnalysis).not.toHaveBeenCalled();
  });

  it("o botão de buscar fica desabilitado sem link", () => {
    limpar();
    render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    expect(screen.getByRole("button", { name: /buscar vaga/i })).toBeDisabled();
  });

  it("analisar no modo link sem ter buscado a vaga avisa e não chama a análise", async () => {
    limpar();
    const { container } = render(<AnonAtsForm />);
    fireEvent.click(abaLink());
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });

    expect(await screen.findByRole("alert")).toHaveTextContent(/busque a vaga pelo link ou cole o texto/i);
    expect(runAnonAtsAnalysis).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("anon_ats_started", expect.anything());
  });
});
