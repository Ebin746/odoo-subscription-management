// Verifies the login token. The secret and token shape match backend/src/shared/auth.ts and the auth module.
import jwt from 'jsonwebtoken';

export type SessionRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface SessionUser {
  id: string;
  role: SessionRole;
  email: string;
}

export function verifyToken(token: string | null | undefined): SessionUser | null {
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
    const payload = jwt.verify(token, secret) as { userId: string; role: SessionRole; email: string };
    return { id: payload.userId, role: payload.role, email: payload.email };
  } catch {
    return null;
  }
}
