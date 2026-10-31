import type { NextRequest } from 'next/server';

// The proxy overwrites x-dev-role / x-dev-user-id from the verified login token, so these are trustworthy.
// A customer may only act on their own records; staff and admin may act on any.
export function mayActOn(req: NextRequest, ownerId: string): boolean {
  const role = (req.headers.get('x-dev-role') || '').toUpperCase();
  if (role !== 'CUSTOMER') return true;
  return req.headers.get('x-dev-user-id') === ownerId;
}
