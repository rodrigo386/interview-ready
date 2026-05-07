const CODE_REGEX = /^[A-Z0-9-]{2,40}$/;

export function validateCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== "string") return false;
  return CODE_REGEX.test(code);
}

export function generateCodeFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
