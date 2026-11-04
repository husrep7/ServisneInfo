// Admin prijava ADMIN_TOKEN-om (KTD8). Token se čuva samo u sessionStorage tog taba
// i šalje kao Bearer; pravu provjeru radi backend (requireAdmin), pa se token ovdje
// provjerava jednim pozivom prema admin API-ju.

const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
