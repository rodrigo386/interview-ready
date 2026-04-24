// Next.js instrumentation hook — runs ONCE on server startup, before any
// route or server action loads. Used here to install Web API stubs that
// pdfjs-dist@5 references at module load time. Without these, importing
// pdf-parse on Railway (Alpine, no @napi-rs/canvas) prints
// "Cannot polyfill DOMMatrix/ImageData/Path2D" warnings at boot and throws
// "ReferenceError: DOMMatrix is not defined" on PDFs with vector transforms.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/files/dom-polyfill");
  }
}
