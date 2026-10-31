// Server-side session helper for server components and route handlers.
import { cookies } from 'next/headers';
import { verifyToken, type SessionUser } from './verifyToken';

export type { SessionUser, SessionRole } from './verifyToken';

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifyToken(store.get('auth_token')?.value);
}
