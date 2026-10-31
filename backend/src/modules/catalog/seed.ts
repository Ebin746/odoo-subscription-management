import dotenv from 'dotenv';
dotenv.config();

import { BillingPeriod, PaymentTerms, Role, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';

async function main() {
  console.log('🌱 Starting P2 Catalog Seed...');

  // 1. Ensure a default admin user & demo customer exist
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.com' },
    update: {},
    create: {
      email: 'admin@brightloop.com',
      passwordHash: '$2b$10$demoHashedPasswordAdmin123456789!',
      role: Role.ADMIN,
      name: 'Brightloop Administrator',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@acmecorp.com' },
    update: {},
    create: {
      email: 'customer@acmecorp.com',
      passwordHash: '$2b$10$demoHashedPasswordCustomer123!',
      role: Role.CUSTOMER,
      name: 'Acme Corporation Ltd',
      companyName: 'Acme Corp',
      phone: '+1-555-0199',
      billingAddress: '100 Silicon Blvd, Suite 400, San Francisco, CA',
    },
  });

  console.log(`✓ Admin & Customer ready: ${admin.email}, ${customer.email}`);

  // 2. Ensure default tax exists
  let tax = await prisma.tax.findFirst({ where: { name: 'Standard GST 18%' } });
  if (!tax) {
    tax = await prisma.tax.create({
      data: {
        name: 'Standard GST 18%',
        ratePercent: 18.0,
      },
    });
  }

  // 3. Create Core Products & Variants (R6, R7)
  console.log('Creating Products & Variants...');
  const productData = [
    {
      name: 'Brightloop ERP Core',
      type: 'Software',
      salesPrice: 1200.0,
      costPrice: 400.0,
      notes: 'Complete ERP suite for modern businesses',
      taxId: tax.id,
      variants: [
        { attribute: 'Brand', value: 'Standard', extraPrice: 0 },
        { attribute: 'Brand', value: 'Odoo Enterprise Edition', extraPrice: 560.0 }, // R7 specific
      ],
    },
    {
      name: 'Brightloop CRM Pro',
      type: 'Software',
      salesPrice: 450.0,
      costPrice: 150.0,
      notes: 'Customer relationship and pipeline management',
      taxId: tax.id,
      variants: [
        { attribute: 'Edition', value: 'Standard', extraPrice: 0 },
        { attribute: 'Edition', value: 'Advanced AI Analytics', extraPrice: 150.0 },
      ],
    },
    {
      name: 'Dedicated Cloud Database Add-on',
      type: 'Add-on',
      salesPrice: 200.0,
      costPrice: 75.0,
      notes: 'Isolated high-performance Postgres cluster',
      taxId: tax.id,
      variants: [
        { attribute: 'Storage', value: '100GB NVMe', extraPrice: 0 },
        { attribute: 'Storage', value: '500GB NVMe', extraPrice: 180.0 },
      ],
    },
    {
      name: 'Priority 24/7 SLA Support',
      type: 'Service',
      salesPrice: 350.0,
      costPrice: 100.0,
      notes: '15-minute response SLA support package',
      taxId: tax.id,
      variants: [],
    },
  ];

  const createdProducts = [];
  for (const p of productData) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      const prod = await prisma.product.create({
        data: {
          name: p.name,
          type: p.type,
          salesPrice: p.salesPrice,
          costPrice: p.costPrice,
          notes: p.notes,
          taxId: p.taxId,
          variants: {
            create: p.variants,
          },
        },
        include: { variants: true },
      });
      createdProducts.push(prod);
    } else {
      const withVariants = await prisma.product.findUnique({
        where: { id: existing.id },
        include: { variants: true },
      });
      createdProducts.push(withVariants!);
    }
  }

  // 4. Create Plans (R8, R9)
  console.log('Creating Plans...');
  const planData = [
    {
      name: 'Brightloop Monthly Growth',
      price: 299.0,
      billingPeriod: BillingPeriod.MONTHLY,
      minQuantity: 1,
      autoClose: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenew: true,
    },
    {
      name: 'Brightloop Yearly Enterprise',
      price: 2990.0,
      billingPeriod: BillingPeriod.YEARLY,
      minQuantity: 1,
      autoClose: true, // auto-closes at expiry
      allowEarlyClose: true,
      allowPause: false,
      allowRenew: true,
    },
    {
      name: 'Brightloop Weekly Sprint',
      price: 89.0,
      billingPeriod: BillingPeriod.WEEKLY,
      minQuantity: 1,
      autoClose: true,
      allowEarlyClose: false,
      allowPause: false,
      allowRenew: false,
    },
  ];

  const createdPlans = [];
  for (const pl of planData) {
    let plan = await prisma.plan.findFirst({ where: { name: pl.name } });
    if (!plan) {
      plan = await prisma.plan.create({ data: pl });
    }
    createdPlans.push(plan);
  }

  // 5. Create Quotation Template (R10)
  console.log('Creating Quotation Template...');
  let template = await prisma.quotationTemplate.findFirst({
    where: { name: 'Standard Enterprise Bundle' },
  });
  if (!template) {
    template = await prisma.quotationTemplate.create({
      data: {
        name: 'Standard Enterprise Bundle',
        planId: createdPlans[1].id,
        validityDays: 30,
        lines: {
          create: [
            {
              productId: createdProducts[0].id,
              variantId: createdProducts[0].variants[1]?.id || null, // Odoo variant
              quantity: 5,
            },
            {
              productId: createdProducts[2].id,
              quantity: 1,
            },
          ],
        },
      },
    });
  }

  // 6. Volume Seeding: 5,000 Subscriptions + Lines (R23 Performance requirement)
  const currentCount = await prisma.subscription.count();
  const targetCount = 5000;
  const needed = Math.max(0, targetCount - currentCount);

  if (needed > 0) {
    console.log(`Seeding ${needed} high-volume subscriptions to satisfy 5,000+ benchmark...`);

    const statuses: SubscriptionStatus[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.CONFIRMED,
      SubscriptionStatus.QUOTATION,
      SubscriptionStatus.DRAFT,
      SubscriptionStatus.CLOSED,
    ];

    const terms: PaymentTerms[] = [PaymentTerms.IMMEDIATE, PaymentTerms.NET_15, PaymentTerms.NET_30];

    const batchSize = 500;
    const batches = Math.ceil(needed / batchSize);

    for (let b = 0; b < batches; b++) {
      const itemsInThisBatch = Math.min(batchSize, needed - b * batchSize);
      const subsToInsert = [];

      const startIdx = currentCount + b * batchSize + 1;
      for (let i = 0; i < itemsInThisBatch; i++) {
        const seq = startIdx + i;
        const number = `SUB-${String(seq).padStart(6, '0')}`;
        const plan = createdPlans[seq % createdPlans.length];
        const status = statuses[seq % statuses.length];
        const term = terms[seq % terms.length];

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (seq % 180));
        const expiryDate = new Date(startDate);
        expiryDate.setMonth(expiryDate.getMonth() + 1);

        subsToInsert.push({
          number,
          customerId: customer.id,
          planId: plan.id,
          templateId: template?.id || null,
          createdById: admin.id,
          status,
          startDate,
          expiryDate,
          paymentTerms: term,
          isPaused: status === SubscriptionStatus.ACTIVE && seq % 7 === 0,
          pausedAt: status === SubscriptionStatus.ACTIVE && seq % 7 === 0 ? new Date() : null,
          closedAt: status === SubscriptionStatus.CLOSED ? new Date() : null,
          subtotal: 1200.0,
          taxTotal: 216.0,
          total: 1416.0,
        });
      }

      await prisma.subscription.createMany({
        data: subsToInsert,
        skipDuplicates: true,
      });

      console.log(`  - Seeded batch ${b + 1}/${batches} (${itemsInThisBatch} subscriptions)`);
    }

    // Connect lines for the first 100 subscriptions so detail pages have rich lines
    console.log('Generating subscription lines for sample records...');
    const sampleSubs = await prisma.subscription.findMany({
      take: 100,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    const linesToInsert = [];
    for (const s of sampleSubs) {
      if (s.lines.length === 0) {
        linesToInsert.push({
          subscriptionId: s.id,
          productId: createdProducts[0].id,
          variantId: createdProducts[0].variants[0]?.id || null,
          taxId: tax.id,
          quantity: 2,
          unitPrice: 1200.0,
          taxAmount: 432.0,
          amount: 2832.0,
        });
      }
    }

    if (linesToInsert.length > 0) {
      await prisma.subscriptionLine.createMany({
        data: linesToInsert,
      });
    }
  }

  const finalCount = await prisma.subscription.count();
  console.log(`✅ P2 Catalog Seed Completed. Total Subscriptions in DB: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
