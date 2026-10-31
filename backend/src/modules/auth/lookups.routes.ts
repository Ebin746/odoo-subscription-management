// Customers lookup — GET /api/lookups/customers
// Owner: P1
// Returns [{ id, label }] — read-only picker endpoint for P3 invoice creation

import { Router } from 'express';
import { lookupsController } from './lookups.controller';

export const lookupsRouter = Router();

// GET /api/lookups/customers?search=&limit=
lookupsRouter.get('/customers', lookupsController.listCustomers);

