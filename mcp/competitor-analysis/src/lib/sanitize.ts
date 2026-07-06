const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG = /<[^>]*>/g;

export function sanitizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value
    .replace(CONTROL_CHARS, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(HTML_TAG, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export function sanitizeStringList(values: string[]): string[] {
  return values
    .map((v) => sanitizeText(v))
    .filter((v): v is string => Boolean(v));
}
