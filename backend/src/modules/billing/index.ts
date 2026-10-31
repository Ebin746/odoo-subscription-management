import { taxesRouter } from './taxes';
import { discountsRouter } from './discounts';
import { invoicesRouter } from './invoices';
import { billingLookupsRouter } from './lookups';
import './billing'; // registers the daily billing job

export const billingRouters = { taxesRouter, discountsRouter, invoicesRouter };
export { billingLookupsRouter };
