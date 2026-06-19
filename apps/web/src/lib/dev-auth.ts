/** Local-only auth bypass. Never enable outside development. */

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true" &&
    Boolean(process.env.DEV_AUTH_USER_ID?.trim())
  );
}

export function getDevAuthUser() {
  return {
    id: process.env.DEV_AUTH_USER_ID!.trim(),
    email: process.env.DEV_AUTH_EMAIL?.trim() || "dev@example.com",
  };
}

export function getDevAuthToken(): string {
  return process.env.DEV_AUTH_TOKEN?.trim() || "rankforge-dev-local";
}
