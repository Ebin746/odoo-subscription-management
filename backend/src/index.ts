import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { catalogModuleRouter, lookupsRouter } from './modules/catalog';
import { billingRouters, billingLookupsRouter } from './modules/billing';
import { paymentsModuleRouter } from './modules/payments';
import { authRouter, usersRouter, lookupsRouter as authLookupsRouter } from './modules/auth';
import { errorHandler } from './shared/errorHandler';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health Check
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', service: 'catalog-service', timestamp: new Date().toISOString() });
});

// Lookups (Published for P1, P3, P4)
app.use('/api/lookups', lookupsRouter);
app.use('/api/lookups', authLookupsRouter);
app.use('/api/lookups', billingLookupsRouter);

// Catalog Slice (P2)
app.use('/api/catalog', catalogModuleRouter);

// Billing Slice (P3)
app.use('/api/taxes', billingRouters.taxesRouter);
app.use('/api/discounts', billingRouters.discountsRouter);
app.use('/api/invoices', billingRouters.invoicesRouter);

// Payments & Reporting Slice (P4)
app.use('/api/payments', paymentsModuleRouter);

// Auth & Users Slice (P1)
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Must be mounted last
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`   - Lookups: http://localhost:${port}/api/lookups/products`);
  console.log(`   - Catalog: http://localhost:${port}/api/catalog/products`);
  console.log(`   - Payments: http://localhost:${port}/api/payments`);
  console.log(`   - Finance Dashboard: http://localhost:${port}/api/payments/dashboard`);
});
