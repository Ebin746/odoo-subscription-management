import { BillingPeriod, DiscountScope, DiscountType, InvoiceLineKind, PaymentTerms, Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { calculateLine } from '../../shared/pricing';

const CHUNK_SIZE = 200; // subscriptions loaded per database round trip
const PARALLEL = 10; // subscriptions billed concurrently inside a chunk
const MAX_PERIODS_PER_SUBSCRIPTION = 500; // safety cap for catch-up

export interface BillingResult {
  runDate: string;
  subscriptionsChecked: number;
  invoicesCreated: number;
  skippedExisting: number;
  failed: { subscriptionId: string; error: string }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Dates are @db.Date, so all period maths is done in UTC at midnight.
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

// Start of period number n (0-based), always counted from the subscription start so month ends never drift.
export function periodStartAt(start: Date, billing: BillingPeriod, n: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const day = start.getUTCDate();
  switch (billing) {
    case BillingPeriod.DAILY:
      return addDays(start, n);
    case BillingPeriod.WEEKLY:
      return addDays(start, n * 7);
    case BillingPeriod.MONTHLY: {
      const target = new Date(Date.UTC(y, m + n, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)));
    }
    case BillingPeriod.YEARLY: {
      const lastDay = new Date(Date.UTC(y + n, m + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y + n, m, Math.min(day, lastDay)));
    }
  }
}

function dueDateFor(issueDate: Date, terms: PaymentTerms): Date {
  if (terms === PaymentTerms.NET_15) return addDays(issueDate, 15);
  if (terms === PaymentTerms.NET_30) return addDays(issueDate, 30);
  return issueDate;
}

type SubscriptionForBilling = Prisma.SubscriptionGetPayload<{
  include: { customer: true; plan: true; lines: { include: { product: true; tax: true } } };
}>;

type DiscountWithTargets = Prisma.DiscountGetPayload<{ include: { targets: true } }>;

interface DraftLine {
  kind: InvoiceLineKind;
  productId: string | null;
  discountId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  amount: number;
  // pre-tax line total, used for discount maths
  subtotal: number;
}

function buildProductLines(sub: SubscriptionForBilling): DraftLine[] {
  return sub.lines.map((line) => {
    // Tax rules are admin managed: an inactive tax stops applying to new invoices.
    const taxPercent = line.tax && line.tax.isActive ? Number(line.tax.ratePercent) : 0;
    const calc = calculateLine({ quantity: line.quantity, unitPrice: Number(line.unitPrice), taxRate: taxPercent });
    return {
      kind: InvoiceLineKind.PRODUCT,
      productId: line.productId,
      discountId: null,
      description: line.product.name,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      taxPercent,
      taxAmount: calc.taxAmount,
      amount: calc.amount,
      subtotal: calc.subtotal,
    };
  });
}

// Works out which discounts apply to the product lines and how much each one takes off (before tax).
function evaluateDiscounts(
  sub: SubscriptionForBilling,
  productLines: DraftLine[],
  discounts: DiscountWithTargets[]
): { discount: DiscountWithTargets; amount: number; taxReduction: number; taxPercent: number }[] {
  const invoiceSubtotal = round2(productLines.reduce((s, l) => s + l.subtotal, 0));
  let remaining = invoiceSubtotal;
  const result: { discount: DiscountWithTargets; amount: number; taxReduction: number; taxPercent: number }[] = [];

  for (const discount of discounts) {
    let eligible: DraftLine[];
    if (discount.scope === DiscountScope.PRODUCT) {
      const productIds = new Set(discount.targets.map((t) => t.productId).filter(Boolean));
      eligible = productLines.filter((l) => l.productId && productIds.has(l.productId));
    } else {
      // Whole-subscription discount: with no targets it covers every subscription, otherwise only the listed ones.
      const subIds = discount.targets.map((t) => t.subscriptionId).filter(Boolean);
      eligible = subIds.length === 0 || subIds.includes(sub.id) ? productLines : [];
    }
    if (eligible.length === 0) continue;

    const base = round2(eligible.reduce((s, l) => s + l.subtotal, 0));
    const quantity = eligible.reduce((s, l) => s + l.quantity, 0);
    if (discount.minPurchaseAmount !== null && base < Number(discount.minPurchaseAmount)) continue;
    if (discount.minQuantity !== null && quantity < discount.minQuantity) continue;

    let amount =
      discount.type === DiscountType.PERCENTAGE ? round2((base * Number(discount.value)) / 100) : Number(discount.value);
    amount = round2(Math.min(amount, base, remaining));
    if (amount <= 0) continue;
    remaining = round2(remaining - amount);

    // Tax comes off in the same proportion as the eligible lines are taxed.
    const eligibleTax = eligible.reduce((s, l) => s + l.taxAmount, 0);
    const taxPercent = base > 0 ? round2((eligibleTax / base) * 100) : 0;
    const taxReduction = base > 0 ? round2((amount * eligibleTax) / base) : 0;
    result.push({ discount, amount, taxReduction, taxPercent });
  }
  return result;
}

// Creates the invoice for one subscription period. Returns false when the period was already billed.
async function createInvoiceForPeriod(
  sub: SubscriptionForBilling,
  periodStart: Date,
  periodEnd: Date,
  issueDate: Date,
  candidateDiscounts: DiscountWithTargets[]
): Promise<boolean> {
  const productLines = buildProductLines(sub);
  const planned = evaluateDiscounts(sub, productLines, candidateDiscounts);

  try {
    await prisma.$transaction(async (tx) => {
      // Claim a use of each discount atomically; if the limit was reached meanwhile, the discount is dropped.
      const claimed: typeof planned = [];
      for (const p of planned) {
        const updated = await tx.$executeRaw`
          UPDATE "Discount" SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${p.discount.id}::uuid AND "isActive" = true
            AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
        if (updated === 1) claimed.push(p);
      }

      const discountLines: DraftLine[] = claimed.map((p) => ({
        kind: InvoiceLineKind.DISCOUNT,
        productId: null,
        discountId: p.discount.id,
        description: `Discount: ${p.discount.name}`,
        quantity: 1,
        unitPrice: -p.amount,
        taxPercent: p.taxPercent,
        taxAmount: -p.taxReduction,
        amount: round2(-(p.amount + p.taxReduction)),
        subtotal: -p.amount,
      }));

      const lines = [...productLines, ...discountLines];
      const subtotal = round2(productLines.reduce((s, l) => s + l.subtotal, 0));
      const discountTotal = round2(claimed.reduce((s, p) => s + p.amount, 0));
      const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
      const total = round2(lines.reduce((s, l) => s + l.amount, 0));

      const invoice = await tx.invoice.create({
        data: {
          number: `TMP-${sub.id}-${periodStart.toISOString().slice(0, 10)}`,
          subscriptionId: sub.id,
          customerId: sub.customerId,
          periodStart,
          periodEnd,
          issueDate,
          dueDate: dueDateFor(issueDate, sub.paymentTerms),
          customerName: sub.customer.name,
          customerEmail: sub.customer.email,
          customerCompany: sub.customer.companyName,
          customerAddress: sub.customer.billingAddress,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          lines: {
            create: lines.map((l) => ({
              kind: l.kind,
              productId: l.productId,
              discountId: l.discountId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxPercent: l.taxPercent,
              taxAmount: l.taxAmount,
              amount: l.amount,
            })),
          },
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { number: `INV-${String(invoice.seq).padStart(6, '0')}` },
      });

      if (claimed.length > 0) {
        await tx.discountUsage.createMany({
          data: claimed.map((p) => ({ discountId: p.discount.id, invoiceId: invoice.id, amount: p.amount })),
        });
      }
    });
    return true;
  } catch (err: any) {
    // Unique (subscriptionId, periodStart): another run already billed this period. The transaction rolled back,
    // so any discount use claimed above is released too.
    if (err.code === 'P2002') return false;
    throw err;
  }
}

async function billSubscription(
  sub: SubscriptionForBilling,
  runDate: Date,
  candidateDiscounts: DiscountWithTargets[]
): Promise<{ created: number; skipped: number }> {
  const billing = sub.plan.billingPeriod;
  const start = startOfUtcDay(sub.startDate);
  const expiry = startOfUtcDay(sub.expiryDate);

  // Every period that has started and is not yet billed, so a missed run is caught up on the next one.
  const dues: { start: Date; end: Date }[] = [];
  for (let n = 0; n < MAX_PERIODS_PER_SUBSCRIPTION; n++) {
    const pStart = periodStartAt(start, billing, n);
    if (pStart > runDate || pStart > expiry) break;
    const next = periodStartAt(start, billing, n + 1);
    const pEnd = addDays(next, -1);
    dues.push({ start: pStart, end: pEnd > expiry ? expiry : pEnd });
  }
  if (dues.length === 0) return { created: 0, skipped: 0 };

  const existing = await prisma.invoice.findMany({
    where: { subscriptionId: sub.id, periodStart: { in: dues.map((d) => d.start) } },
    select: { periodStart: true },
  });
  const billed = new Set(existing.map((e) => e.periodStart.toISOString()));

  let created = 0;
  let skipped = 0;
  for (const due of dues) {
    if (billed.has(due.start.toISOString())) {
      skipped++;
      continue;
    }
    // Discounts are checked on the date the invoice is issued.
    const usable = candidateDiscounts.filter((d) => d.usageLimit === null || d.usedCount < d.usageLimit);
    const ok = await createInvoiceForPeriod(sub, due.start, due.end, runDate, usable);
    if (ok) created++;
    else skipped++;
  }
  return { created, skipped };
}

const dueWhere = (runDate: Date): Prisma.SubscriptionWhereInput => ({
  status: SubscriptionStatus.ACTIVE,
  isPaused: false,
  startDate: { lte: runDate },
  lines: { some: {} },
});

// Ids of the subscriptions to bill, in pages. Only ids are loaded here; the full rows are loaded per chunk.
export async function* subscriptionIdPages(runDate: Date, pageSize = CHUNK_SIZE): AsyncGenerator<string[]> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.subscription.findMany({
      where: dueWhere(runDate),
      select: { id: true },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) return;
    cursor = rows[rows.length - 1].id;
    yield rows.map((r) => r.id);
    if (rows.length < pageSize) return;
  }
}

export interface ChunkResult {
  checked: number;
  created: number;
  skipped: number;
  failed: { subscriptionId: string; error: string }[];
}

// Bills one chunk of subscriptions. Safe to repeat: the unique (subscriptionId, periodStart) stops double billing,
// so a queue retry of a half-finished chunk only creates what is still missing.
export async function billChunk(ids: string[], runDate: Date): Promise<ChunkResult> {
  const result: ChunkResult = { checked: 0, created: 0, skipped: 0, failed: [] };
  if (ids.length === 0) return result;

  const chunk: SubscriptionForBilling[] = await prisma.subscription.findMany({
    where: { id: { in: ids }, ...dueWhere(runDate) },
    include: { customer: true, plan: true, lines: { include: { product: true, tax: true } } },
    orderBy: { id: 'asc' },
  });

  // Valid discounts are loaded once per chunk, not once per subscription.
  const discounts = await prisma.discount.findMany({
    where: { isActive: true, startDate: { lte: runDate }, endDate: { gte: runDate } },
    include: { targets: true },
    orderBy: { createdAt: 'asc' },
  });

  for (let i = 0; i < chunk.length; i += PARALLEL) {
    const batch = chunk.slice(i, i + PARALLEL);
    const outcomes = await Promise.allSettled(batch.map((sub) => billSubscription(sub, runDate, discounts)));
    outcomes.forEach((outcome, idx) => {
      result.checked++;
      if (outcome.status === 'fulfilled') {
        result.created += outcome.value.created;
        result.skipped += outcome.value.skipped;
      } else {
        result.failed.push({ subscriptionId: batch[idx].id, error: String(outcome.reason?.message || outcome.reason) });
      }
    });
  }
  return result;
}

// Bills every due period of every active, unpaused subscription, here and now (no queue).
// Safe to run repeatedly and in parallel.
export async function runBilling(runDateInput: Date = new Date()): Promise<BillingResult> {
  const runDate = startOfUtcDay(runDateInput);
  const result: BillingResult = {
    runDate: runDate.toISOString().slice(0, 10),
    subscriptionsChecked: 0,
    invoicesCreated: 0,
    skippedExisting: 0,
    failed: [],
  };

  for await (const ids of subscriptionIdPages(runDate)) {
    const chunk = await billChunk(ids, runDate);
    result.subscriptionsChecked += chunk.checked;
    result.invoicesCreated += chunk.created;
    result.skippedExisting += chunk.skipped;
    result.failed.push(...chunk.failed);
  }

  console.log(
    `[BillingJob] ${result.invoicesCreated} invoices created, ${result.skippedExisting} already billed, ${result.failed.length} failed`
  );
  return result;
}
