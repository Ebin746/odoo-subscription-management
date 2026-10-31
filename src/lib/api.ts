// Fetch wrapper — unwraps { data, error } responses from the backend.
// Owner: P1
//
// Usage:
//   const { data, error } = await apiFetch<User[]>('/api/users/customers');
//   if (error) { /* show error */ }

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    const json: ApiResponse<T> = await res.json();
    return json;
  } catch {
    return { data: null, error: 'Network error — could not reach the server.' };
  }
}

