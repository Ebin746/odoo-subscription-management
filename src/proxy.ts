// Access control for pages and the Next.js API routes (Next 16 "proxy", formerly middleware).
// Reads the login token from the auth_token cookie (pages, same-origin fetches) or the Authorization header.
// It is a gate in front of server-rendered pages that read the database directly; the Express API
// (taxes, discounts, invoices, auth) checks the token itself.
import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, type SessionRole } from '@/lib/verifyToken';
import { isTokenDenied } from '@backend/shared/redis/session';

type Rule = SessionRole[] | 'any';

const STAFF: SessionRole[] = ['ADMIN', 'STAFF'];
const ADMIN: SessionRole[] = ['ADMIN'];

const PUBLIC_PAGES = ['/', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];

// First match wins; anything under these prefixes that is not listed needs a login only.
const PAGE_RULES: [string, Rule][] = [
  ['/auth/staff', ADMIN],
  ['/auth/customers', STAFF],
  ['/billing/my-invoices', 'any'],
  ['/billing/taxes', ADMIN],
  ['/billing/discounts', ADMIN],
  ['/billing', STAFF],
  ['/payments/my-payments', 'any'],
  ['/payments', STAFF],
  ['/catalog/my-subscriptions', 'any'],
  ['/catalog', STAFF],
];

const API_RULES: [RegExp, Rule][] = [
  [/^\/api\/payments\/mine(\/|$)/, 'any'],
  [/^\/api\/payments(\/|$)/, STAFF],
  [/^\/api\/catalog\/my-subscriptions(\/|$)/, 'any'],
  // customers use these actions on their own subscriptions, when the plan allows it
  [/^\/api\/catalog\/subscriptions\/[^/]+\/(pause|resume|renew|close-early)$/, 'any'],
  [/^\/api\/catalog(\/|$)/, STAFF],
  [/^\/api\/lookups(\/|$)/, 'any'],
];

function ruleFor(pathname: string): Rule | null {
  if (pathname.startsWith('/api/')) {
    return API_RULES.find(([re]) => re.test(pathname))?.[1] ?? null;
  }
  if (PUBLIC_PAGES.includes(pathname)) return null;
  const hit = PAGE_RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'));
  return hit ? hit[1] : 'any';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const rule = ruleFor(pathname);
  if (rule === null) return NextResponse.next();

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const rawToken = request.cookies.get('auth_token')?.value || bearer;
  let user = verifyToken(rawToken);
  // A token that was logged out is dead even though its signature is still valid
  if (user && rawToken && (await isTokenDenied(rawToken))) user = null;

  // Outside production the dev headers still work (same as the Express API) so scripts can call the routes.
  let role = user?.role;
  let userId = user?.id;
  if (!user && isApi && process.env.NODE_ENV !== 'production') {
    const devRole = request.headers.get('x-dev-role')?.toUpperCase() as SessionRole | undefined;
    if (devRole) {
      role = devRole;
      userId = request.headers.get('x-dev-user-id') || undefined;
    }
  }

  if (!role) {
    if (isApi) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    const login = new URL('/auth/login', request.url);
    return NextResponse.redirect(login);
  }

  if (rule !== 'any' && !rule.includes(role)) {
    if (isApi) {
      return NextResponse.json({ data: null, error: 'Forbidden: insufficient role privileges' }, { status: 403 });
    }
    return NextResponse.redirect(new URL(role === 'CUSTOMER' ? '/portal' : '/catalog', request.url));
  }

  // Route handlers trust these headers, so always overwrite whatever the client sent.
  const headers = new Headers(request.headers);
  headers.set('x-dev-role', role);
  if (userId) headers.set('x-dev-user-id', userId);
  else headers.delete('x-dev-user-id');
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
