// Keeps the login token in two places: localStorage (sent as a Bearer header by the API helpers)
// and a cookie (so the Next.js proxy and server-rendered pages know who is asking).

const KEY = 'auth_token';
const MAX_AGE = 60 * 60 * 24; // matches the backend's default 1d token lifetime

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, token);
  document.cookie = `${KEY}=${token}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  document.cookie = `${KEY}=; path=/; max-age=0; SameSite=Lax`;
}
