import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { AnonAtsForm } from "./AnonAtsForm";

// A server action de verdade puxa next/headers, env e o admin client do
// Supabase — nada disso é o assunto deste teste, que é o comportamento do
// formulário no navegador.
vi.mock("@/app/analise-ats-gratis/actions", () => ({
  runAnonAtsAnalysis: vi.fn(async () => null),
}));
vi.mock("@/lib/analytics/client", () => ({ track: vi.fn() }));

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

  it("não reclama de arquivo dentro do limite", () => {
    const { getByLabelText, queryByRole } = render(<AnonAtsForm />);
    const input = getByLabelText(/envie seu currículo/i) as HTMLInputElement;
    const ok = new File(["x"], "cv.pdf", { type: "application/pdf" });
    Object.defineProperty(ok, "size", { value: 1024 });

    fireEvent.change(input, { target: { files: [ok] } });

    expect(queryByRole("alert")).toBeNull();
  });
});
