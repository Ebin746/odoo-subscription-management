// Global Express error handler — mount LAST in index.ts / app.ts
// Owner: P1
// Converts AppError (and any unexpected Error) to { data: null, error: message }

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ data: null, error: err.message });
    return;
  }

  // Unknown error — log it, return generic 500
  console.error('[Unhandled error]', err);
  res.status(500).json({ data: null, error: 'Internal server error' });
}

// Wraps an async route handler so it forwards thrown errors to errorHandler.
// Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

