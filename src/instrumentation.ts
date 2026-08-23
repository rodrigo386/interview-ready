// Next.js instrumentation hook — runs ONCE on server startup, before any
// route or server action loads. Used here to install Web API stubs that
// pdfjs-dist@5 references at module load time. Without these, importing
// pdf-parse on Railway (Alpine, no @napi-rs/canvas) prints
// "Cannot polyfill DOMMatrix/ImageData/Path2D" warnings at boot and throws
// "ReferenceError: DOMMatrix is not defined" on PDFs with vector transforms.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/files/dom-polyfill");
    // Grita no boot quando uma integração inteira está desligada por env var
    // ausente. Duas vezes este repo rodou meses com um subsistema morto sem
    // ninguém saber (rate limits, depois o funil inteiro) — a falha é
    // silenciosa por natureza, então o alarme tem que ser explícito.
    const { avisarIntegracoesInertes } = await import("./lib/env");
    avisarIntegracoesInertes();
  }
}
