import { Router, Request, Response } from 'express';
import { productsRouter } from './products';
import { plansRouter } from './plans';
import { templatesRouter } from './templates';
import { subscriptionsRouter } from './subscriptions';
import { lookupsRouter } from './lookups';
import { autoCloseExpiredSubscriptions } from './autoCloseJob';
import { requireRole } from '../../shared/auth';

export const catalogModuleRouter = Router();

catalogModuleRouter.use('/products', productsRouter);
catalogModuleRouter.use('/plans', plansRouter);
catalogModuleRouter.use('/quotation-templates', templatesRouter);
catalogModuleRouter.use('/subscriptions', subscriptionsRouter);

// Manual trigger for testing daily auto-close
catalogModuleRouter.post(
  '/jobs/run-auto-close',
  requireRole('ADMIN', 'STAFF'),
  async (_req: Request, res: Response) => {
    try {
      const result = await autoCloseExpiredSubscriptions();
      res.json({ data: result, error: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: err.message || 'Auto-close failed' });
    }
  }
);

export { lookupsRouter };
