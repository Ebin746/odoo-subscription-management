import { Request, Response, NextFunction } from 'express';

export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Dev stub: reads headers x-dev-user-id and x-dev-role (defaults to ADMIN in dev)
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req.headers['x-dev-user-id'] as string) || '00000000-0000-0000-0000-000000000001';
  const role = ((req.headers['x-dev-role'] as string)?.toUpperCase() as Role) || 'ADMIN';

  req.user = {
    id: userId,
    role: role,
  };

  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: insufficient role privileges' });
        return;
      }
      next();
    });
  };
}
