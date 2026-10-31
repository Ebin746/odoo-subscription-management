import { forgetAuthUser } from '../../shared/redis/session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/db';
import { AppError } from '../../shared/errors';
import { safeUserSelect, type SafeUser } from './auth.service';

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const usersService = {
  async listCustomers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResult<SafeUser>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
    };

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: safeUserSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items as SafeUser[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async createCustomer(input: {
    email: string;
    name: string;
    password?: string;
    companyName?: string | null;
    phone?: string | null;
    billingAddress?: string | null;
  }): Promise<SafeUser> {
    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    // If password not supplied, generate a strong temporary random password
    const rawPass = input.password || `Tmp_${crypto.randomBytes(8).toString('hex')}!`;
    const passwordHash = await bcrypt.hash(rawPass, 10);

    const customer = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
        role: 'CUSTOMER',
        companyName: input.companyName?.trim() || null,
        phone: input.phone?.trim() || null,
        billingAddress: input.billingAddress?.trim() || null,
        isActive: true,
      },
      select: safeUserSelect,
    });

    return customer as SafeUser;
  },

  async getCustomerById(id: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });

    if (!user || user.role !== 'CUSTOMER') {
      throw new AppError(404, 'Customer not found');
    }

    return user as SafeUser;
  },

  async updateCustomer(
    id: string,
    input: {
      name?: string;
      companyName?: string | null;
      phone?: string | null;
      billingAddress?: string | null;
      isActive?: boolean;
    }
  ): Promise<SafeUser> {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existing) {
      throw new AppError(404, 'Customer not found');
    }

    // Critical: STAFF cannot view or edit ADMIN or STAFF accounts
    if (existing.role !== 'CUSTOMER') {
      throw new AppError(403, 'Cannot edit non-customer accounts');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.companyName !== undefined && { companyName: input.companyName?.trim() || null }),
        ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
        ...(input.billingAddress !== undefined && { billingAddress: input.billingAddress?.trim() || null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: safeUserSelect,
    });

    await forgetAuthUser(id); // a deactivation or change applies to logged-in sessions right away
    return updated as SafeUser;
  },

  async getMyProfile(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });

    if (!user || !user.isActive) {
      throw new AppError(404, 'Profile not found');
    }

    return user as SafeUser;
  },
};
