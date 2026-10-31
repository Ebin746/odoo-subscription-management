import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import { getAuthUser, isTokenDenied } from './redis/session';

export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
}

export interface JwtPayload {
  userId: string;
  role: Role;
  email: string;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  // 1. Try real JWT from Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const secret = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';

    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;

      // A token that was logged out stays dead until it expires
      if (await isTokenDenied(token)) {
        res.status(401).json({ data: null, error: 'Session has ended, please log in again' });
        return;
      }

      // Verify user is still active (cached for a minute; changes to the user clear the cache)
      const user = await getAuthUser(decoded.userId, () =>
        prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, role: true, email: true, isActive: true },
        })
      );

      if (!user || !user.isActive) {
        res.status(401).json({ data: null, error: 'Account is deactivated or does not exist' });
        return;
      }

      req.user = {
        id: user.id,
        role: user.role as Role,
        email: user.email,
      };
      next();
      return;
    } catch {
      res.status(401).json({ data: null, error: 'Invalid or expired token' });
      return;
    }
  }

  // 2. Dev-header fallback (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    const devUserId = req.headers['x-dev-user-id'] as string | undefined;
    const devRole = req.headers['x-dev-role'] as string | undefined;

    if (devUserId || devRole) {
      const role = (devRole?.toUpperCase() as Role) || 'CUSTOMER';
      req.user = {
        id: devUserId || '00000000-0000-0000-0000-000000000001',
        role,
      };
      next();
      return;
    }
  }

  res.status(401).json({ data: null, error: 'Unauthorized' });
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        res.status(403).json({ data: null, error: 'Forbidden: insufficient role privileges' });
        return;
      }
      next();
    });
  };
}
