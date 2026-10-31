'use client';

// useCurrentUser — returns the currently logged-in user.
// Owner: P1
// Reads real user from /api/auth/me using JWT stored in localStorage.
// Includes a switch to use a hard-coded dev user for offline dev.

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';
import { clearAuthToken } from './authToken';

export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyName?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Dev Switch: Set USE_DEV_USER to true for hardcoded dev persona
// ─────────────────────────────────────────────────────────────
export const USE_DEV_USER = false;
export const DEV_ROLE: Role = 'ADMIN';

const STUB_USERS: Record<Role, CurrentUser> = {
  ADMIN: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Dev Admin',
    email: 'admin@brightloop.com',
    role: 'ADMIN',
  },
  STAFF: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Dev Staff',
    email: 'staff@brightloop.com',
    role: 'STAFF',
  },
  CUSTOMER: {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Dev Customer',
    email: 'customer@brightloop.com',
    role: 'CUSTOMER',
  },
};

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    if (USE_DEV_USER) return STUB_USERS[DEV_ROLE];
    return null;
  });

  const fetchUser = useCallback(async () => {
    if (USE_DEV_USER) {
      setUser(STUB_USERS[DEV_ROLE]);
      return;
    }

    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      return;
    }

    const res = await apiFetch<CurrentUser>('/api/auth/me');
    if (res.data) {
      setUser(res.data);
    } else {
      clearAuthToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser();
  }, [fetchUser]);

  return user;
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    clearAuthToken();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/auth/login';
  }
}
