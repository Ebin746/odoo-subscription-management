import type { NextFunction, Request, Response } from 'express';
import { getCachedRaw, setCachedRaw } from './cache';
import { redisIfReady } from './client';

// Caches a GET route's successful JSON response. Place it AFTER the auth middleware so only allowed users
// can ever be served a cached answer. Clear it by invalidating the namespace (see cache.ts).
export function cacheResponse(ns: string, ttlSec: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET' || !redisIfReady()) return next();
    const key = req.originalUrl;
    const hit = await getCachedRaw<unknown>(ns, key);
    if (hit !== null) {
      res.setHeader('X-Cache', 'HIT');
      res.json(hit);
      return;
    }
    res.setHeader('X-Cache', 'MISS');
    const send = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200 && body && !body.error) void setCachedRaw(ns, key, body, ttlSec);
      return send(body);
    };
    next();
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PENDING = '__pending__';

// Makes a POST route safe to repeat when the client sends an Idempotency-Key header: the first request
// runs, repeats with the same key get the first answer back instead of doing the work again.
export function idempotentRoute(scope: string, ttlSec = 24 * 60 * 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    const redis = redisIfReady();
    if (!key || !redis) return next();

    const k = `idem:${scope}:${req.user?.id || 'anon'}:${key}`;
    try {
      const first = await redis.set(k, PENDING, 'EX', 60, 'NX');
      if (first !== 'OK') {
        for (let i = 0; i < 50; i++) {
          const stored = await redis.get(k);
          if (stored === null) break;
          if (stored !== PENDING) {
            const { status, body } = JSON.parse(stored);
            res.setHeader('Idempotent-Replay', 'true');
            res.status(status).json(body);
            return;
          }
          await sleep(100);
        }
        res.status(409).json({ data: null, error: 'A request with this idempotency key is still in progress' });
        return;
      }
    } catch {
      return next();
    }

    let captured: { status: number; body: unknown } | null = null;
    const send = res.json.bind(res);
    res.json = (body: any) => {
      captured = { status: res.statusCode, body };
      return send(body);
    };
    res.on('finish', () => {
      // Only successful answers are remembered; a failed attempt may be retried with the same key.
      if (captured && captured.status < 400) void redis.set(k, JSON.stringify(captured), 'EX', ttlSec).catch(() => {});
      else void redis.del(k).catch(() => {});
    });
    next();
  };
}
