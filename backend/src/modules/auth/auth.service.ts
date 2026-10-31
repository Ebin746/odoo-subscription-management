import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/db';
import { AppError } from '../../shared/errors';
import { queueMail } from '../../shared/mailQueue';
import type { Role } from '../../shared/auth';

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  companyName: string | null;
  phone: string | null;
  billingAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  companyName: true,
  phone: true,
  billingAddress: true,
  createdAt: true,
  updatedAt: true,
};

export const authService = {
  async signup(input: {
    email: string;
    password: string;
    name: string;
    companyName?: string | null;
    phone?: string | null;
    billingAddress?: string | null;
  }): Promise<SafeUser> {
    const email = input.email.trim().toLowerCase();

    // Check duplicate
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
        role: 'CUSTOMER', // Always CUSTOMER, ignore anything else
        companyName: input.companyName?.trim() || null,
        phone: input.phone?.trim() || null,
        billingAddress: input.billingAddress?.trim() || null,
        isActive: true,
      },
      select: safeUserSelect,
    });

    return user as SafeUser;
  },

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: SafeUser }> {
    const email = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Generic error for wrong email or wrong password
    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new AppError(401, 'Account is inactive. Please contact support.');
    }

    const secret = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email,
      },
      secret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    );

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      isActive: user.isActive,
      companyName: user.companyName,
      phone: user.phone,
      billingAddress: user.billingAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { token, user: safeUser };
  },

  async getMe(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });

    if (!user || !user.isActive) {
      throw new AppError(404, 'User not found or account is deactivated');
    }

    return user as SafeUser;
  },

  async forgotPassword(input: { email: string }): Promise<{ message: string }> {
    const email = input.email.trim().toLowerCase();
    const message = 'If that email is registered, a reset link has been sent';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // Always return the exact same generic message
      return { message };
    }

    // Generate crypto token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash,
        resetTokenExpiresAt,
      },
    });

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${appUrl}/auth/reset-password?token=${rawToken}`;

    await queueMail({
      to: user.email,
      subject: 'Reset your Brightloop password',
      text: `Reset your password by clicking this link: ${resetLink}`,
      html: `<p>Hello ${user.name},</p><p>We received a request to reset your password. Click the link below to set a new password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });

    return { message };
  },

  async resetPassword(input: { token: string; password: string }): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(input.token.trim()).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: hashedToken,
        resetTokenExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new AppError(400, 'Invalid or expired link');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // Save new password and invalidate token so link works only once
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return { message: 'Password has been reset successfully' };
  },

  async createStaff(input: {
    email: string;
    password: string;
    name: string;
    phone?: string | null;
  }): Promise<SafeUser> {
    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const staff = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
        role: 'STAFF', // Only creates STAFF
        phone: input.phone?.trim() || null,
        isActive: true,
      },
      select: safeUserSelect,
    });

    return staff as SafeUser;
  },

  async listStaff(): Promise<SafeUser[]> {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
    });
    return staff as SafeUser[];
  },
};
