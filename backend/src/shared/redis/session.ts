import { createHash } from 'crypto';
import { del, getJson, setJson } from './cache';

// Login sessions in Redis: a short cache of who a token belongs to (so every API call does not hit the
// database), and a deny-list so that logging out really ends a token before it expires.
const USER_TTL_SEC = 60;
const userKey = (id: string) => `auth:user:${id}`;
const denyKey = (token: string) => `auth:deny:${createHash('sha256').update(token).digest('hex')}`;

export interface AuthUserRecord {
  id: string;
  role: string;
  email: string;
  isActive: boolean;
}

// Returns the user for a token's id, from cache when possible. `load` reads the database on a miss.
export async function getAuthUser(id: string, load: () => Promise<AuthUserRecord | null>): Promise<AuthUserRecord | null> {
  const hit = await getJson<AuthUserRecord>(userKey(id));
  if (hit) return hit;
  const user = await load();
  if (user) await setJson(userKey(id), user, USER_TTL_SEC);
  return user;
}

// Call whenever a user's role or active flag changes, so the change applies immediately.
export async function forgetAuthUser(id: string): Promise<void> {
  await del(userKey(id));
}

// Ends a token for the rest of its life.
export async function denyToken(token: string, secondsLeft: number): Promise<void> {
  if (secondsLeft > 0) await setJson(denyKey(token), 1, secondsLeft);
}

export async function isTokenDenied(token: string): Promise<boolean> {
  return (await getJson<number>(denyKey(token))) !== null;
}
