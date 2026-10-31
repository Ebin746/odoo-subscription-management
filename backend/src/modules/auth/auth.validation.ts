import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Password rule: > 8 chars (min 9), at least 1 uppercase, 1 lowercase, 1 special char
export const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters (at least 9 characters)')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const signupSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').trim(),
  companyName: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const createStaffSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').trim(),
  phone: z.string().trim().optional().nullable(),
});

export const createCustomerSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  name: z.string().min(1, 'Name is required').trim(),
  password: passwordSchema.optional(),
  companyName: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').trim().optional(),
  companyName: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues?.[0]?.message || 'Validation failed';
      res.status(400).json({ data: null, error: firstError });
      return;
    }
    req.body = result.data;
    next();
  };
}
