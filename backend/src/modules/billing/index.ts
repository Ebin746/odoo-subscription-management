import { taxesRouter } from './taxes';
import { discountsRouter } from './discounts';
import { invoicesRouter } from './invoices';
import { billingLookupsRouter } from './lookups';
import './billingRun'; // registers the billing queue handlers and the daily billing job

export const billingRouters = { taxesRouter, discountsRouter, invoicesRouter };
export { billingLookupsRouter };
