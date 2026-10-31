import dotenv from 'dotenv';
dotenv.config();

import { BillingPeriod, DiscountScope, DiscountType, PaymentTerms, Plan, Product, Role, SubscriptionStatus, Tax, User } from '@prisma/client';
import { prisma } from '../../shared/db';
import { calculateLine } from '../../shared/pricing';

// Usage: npm run seed:billing -- [subscriptionCount]   (default 50)
// Inserts active subscriptions that started in the past, so "Run billing now" has work to do.
const COUNT = Math.max(1, parseInt(process.argv[2] || '50', 10));
const CUSTOMERS = 10;

async function main() {
  console.log(`Seeding billing data (${COUNT} subscriptions)...`);

  const taxNames = [
    ['GST 18%', 18],
    ['Reduced 5%', 5],
  ] as const;
  const taxes: Tax[] = [];
  for (const [name, rate] of taxNames) {
    const found = await prisma.tax.findFirst({ where: { name } });
    taxes.push(found ?? (await prisma.tax.create({ data: { name, ratePercent: rate } })));
  }

  const productDefs = [
    ['Seed CRM Licence', 'Software', 100],
    ['Seed Support Pack', 'Service', 40],
    ['Seed Storage Add-on', 'Add-on', 15],
  ] as const;
  const products: Product[] = [];
  for (const [name, type, price] of productDefs) {
    const found = await prisma.product.findFirst({ where: { name } });
    products.push(
      found ?? (await prisma.product.create({ data: { name, type, salesPrice: price, costPrice: price / 2, taxId: taxes[0].id } }))
    );
  }

  const planDefs = [
    ['Seed Monthly', BillingPeriod.MONTHLY],
    ['Seed Weekly', BillingPeriod.WEEKLY],
    ['Seed Yearly', BillingPeriod.YEARLY],
  ] as const;
  const plans: Plan[] = [];
  for (const [name, billingPeriod] of planDefs) {
    const found = await prisma.plan.findFirst({ where: { name } });
    plans.push(found ?? (await prisma.plan.create({ data: { name, price: 100, billingPeriod } })));
  }

  const customers: User[] = [];
  for (let i = 1; i <= CUSTOMERS; i++) {
    customers.push(
      await prisma.user.upsert({
        where: { email: `seed.billing${i}@example.com` },
        update: {},
        create: {
          email: `seed.billing${i}@example.com`,
          passwordHash: 'seed-not-a-real-hash',
          role: Role.CUSTOMER,
          name: `Seed Customer ${i}`,
          companyName: `Seed Co ${i}`,
          billingAddress: `${i} Market Street`,
        },
      })
    );
  }

  const terms = [PaymentTerms.IMMEDIATE, PaymentTerms.NET_15, PaymentTerms.NET_30];
  const today = new Date();
  for (let i = 0; i < COUNT; i++) {
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (i % 4), 1 + (i % 28)));
    const expiryDate = new Date(Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate()));
    const lineProducts = products.slice(0, 1 + (i % 3));

    const lines = lineProducts.map((product, idx) => {
      const tax = taxes[(i + idx) % taxes.length];
      const quantity = 1 + ((i + idx) % 4);
      const calc = calculateLine({ quantity, unitPrice: Number(product.salesPrice), taxRate: Number(tax.ratePercent) });
      return { productId: product.id, taxId: tax.id, quantity, unitPrice: product.salesPrice, taxAmount: calc.taxAmount, amount: calc.amount, subtotal: calc.subtotal };
    });

    const sub = await prisma.subscription.create({
      data: {
        number: `TMP-SEED-${Date.now()}-${i}`,
        customerId: customers[i % CUSTOMERS].id,
        planId: plans[i % plans.length].id,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        expiryDate,
        paymentTerms: terms[i % terms.length],
        subtotal: lines.reduce((s, l) => s + l.subtotal, 0),
        taxTotal: lines.reduce((s, l) => s + l.taxAmount, 0),
        total: lines.reduce((s, l) => s + l.amount, 0),
        lines: {
          create: lines.map(({ subtotal, ...line }) => line),
        },
      },
    });
    await prisma.subscription.update({ where: { id: sub.id }, data: { number: `SUB-${String(sub.seq).padStart(6, '0')}` } });
  }

  // One discount of each kind so billing exercises both paths.
  const discountDefs = [
    { name: 'Seed Welcome 10%', type: DiscountType.PERCENTAGE, value: 10, scope: DiscountScope.SUBSCRIPTION, usageLimit: 5 },
    { name: 'Seed CRM 20 off', type: DiscountType.FIXED, value: 20, scope: DiscountScope.PRODUCT, usageLimit: null },
  ];
  for (const def of discountDefs) {
    if (await prisma.discount.findFirst({ where: { name: def.name } })) continue;
    await prisma.discount.create({
      data: {
        ...def,
        startDate: new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1)),
        endDate: new Date(Date.UTC(today.getUTCFullYear() + 1, 11, 31)),
        targets: def.scope === DiscountScope.PRODUCT ? { create: [{ productId: products[0].id }] } : undefined,
      },
    });
  }

  console.log('Done. Now run billing: POST /api/invoices/run-billing');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
