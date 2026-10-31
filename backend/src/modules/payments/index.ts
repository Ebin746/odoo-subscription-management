import { Router } from 'express';
import { paymentsRouter } from './payments';
import { paymentsInvoicesRouter } from './invoices';
import { paymentsDashboardRouter } from './dashboard';

export const paymentsModuleRouter = Router();

// Sub-routes for P4 Payments module
paymentsModuleRouter.use('/dashboard', paymentsDashboardRouter);
paymentsModuleRouter.use('/invoices', paymentsInvoicesRouter);
paymentsModuleRouter.use('/', paymentsRouter);

export { paymentsRouter, paymentsInvoicesRouter, paymentsDashboardRouter };
