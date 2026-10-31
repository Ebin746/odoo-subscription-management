import { Router } from 'express';
import { usersController } from './users.controller';
import { requireAuth, requireRole } from '../../shared/auth';
import { validateBody, createCustomerSchema, updateCustomerSchema } from './auth.validation';

export const usersRoutes = Router();

// Profile for any authenticated user (Customer, Staff, Admin)
usersRoutes.get('/me', requireAuth, usersController.getMyProfile);

// Customer management endpoints (Admin and Staff only)
usersRoutes.get('/customers', requireRole('ADMIN', 'STAFF'), usersController.listCustomers);
usersRoutes.post('/customers', requireRole('ADMIN', 'STAFF'), validateBody(createCustomerSchema), usersController.createCustomer);
usersRoutes.get('/customers/:id', requireRole('ADMIN', 'STAFF'), usersController.getCustomerById);
usersRoutes.patch('/customers/:id', requireRole('ADMIN', 'STAFF'), validateBody(updateCustomerSchema), usersController.updateCustomer);

