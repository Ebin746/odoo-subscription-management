import type { NextFunction, Request, Response } from 'express';
import { rateHit } from './rate';

interface Options {
  name: string; // counter name, e.g. "invoice-send"
  max: number; // requests allowed per window
  windowSec: number;
  message?: string;
}

// Express middleware: limits per logged-in user (or per IP for anonymous routes such as login).
export function rateLimit({ name, max, windowSec, message }: Options) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const who = req.user?.id || req.ip || 'anonymous';
    const result = await rateHit(`${name}:${who}`, max, windowSec);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      res.status(429).json({ data: null, error: message || 'Too many requests, please try again later.' });
      return;
    }
    next();
  };
}
