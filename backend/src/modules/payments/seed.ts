import dotenv from 'dotenv';
dotenv.config();

import { BillingPeriod, InvoiceStatus, PaymentMethod, PaymentTerms, Role, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';

const TOTAL_PAYMENTS_TO_SEED = 5000;

async function main() {
  console.log(`🌱 Starting P4 Payments Seed (Target: at least ${TOTAL_PAYMENTS_TO_SEED} payments)...`);

  // 1. Ensure staff/admin and customer exist
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

  const staff = await prisma.user.upsert({
    where: { email: 'staff@brightloop.com' },
    update: {},
    create: {
      email: 'staff@brightloop.com',
      passwordHash: '$2b$10$demoHashedPasswordStaff123456789!',
      role: Role.STAFF,
      name: 'Sarah Jenkins (Finance Lead)',
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

  // Ensure Plan and Product exist for generating subscriptions if needed
  let plan = await prisma.plan.findFirst();
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: 'Enterprise Monthly',
        price: 999.0,
        billingPeriod: BillingPeriod.MONTHLY,
        isActive: true,
      },
    });
  }

  // Ensure Tax exists
  let tax = await prisma.tax.findFirst();
  if (!tax) {
    tax = await prisma.tax.create({
      data: {
        name: 'Standard GST 18%',
        ratePercent: 18.0,
      },
    });
  }

  // Ensure at least 1,500 invoices exist to attach 5,000 payments to
  let existingInvoices = await prisma.invoice.findMany({
    select: { id: true, total: true, amountPaid: true, status: true, dueDate: true },
    take: 3000,
  });

  if (existingInvoices.length < 500) {
    console.log(`Found only ${existingInvoices.length} invoices. Generating additional subscriptions & invoices...`);
    
    // Ensure subscription exists
    let sub = await prisma.subscription.findFirst();
    if (!sub) {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      sub = await prisma.subscription.create({
        data: {
          number: `SUB-PAY-0001`,
          customerId: customer.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: today,
          expiryDate: nextMonth,
          paymentTerms: PaymentTerms.NET_15,
          subtotal: 1000,
          taxTotal: 180,
          total: 1180,
        },
      });
    }

    const invoicesToCreate = [];
    const needed = 600 - existingInvoices.length;
    const now = new Date();

    for (let i = 0; i < needed; i++) {
      const periodStart = new Date(Date.UTC(2025, (i % 12), 1 + (i % 25)));
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const issueDate = new Date(periodStart);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 15);

      invoicesToCreate.push({
        subscriptionId: sub.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStart,
        periodEnd,
        issueDate,
        dueDate,
        customerName: customer.name,
        customerEmail: customer.email,
        customerCompany: customer.companyName,
        customerAddress: customer.billingAddress,
        subtotal: 1000.0,
        discountTotal: 0.0,
        taxTotal: 180.0,
        total: 1180.0,
        amountPaid: 0.0,
        number: `INV-PAY-${Date.now()}-${i}`,
      });
    }

    await prisma.invoice.createMany({
      data: invoicesToCreate,
      skipDuplicates: true,
    });

    existingInvoices = await prisma.invoice.findMany({
      select: { id: true, total: true, amountPaid: true, status: true, dueDate: true },
      take: 3000,
    });
    console.log(`✓ Invoices ready: ${existingInvoices.length}`);
  }

  const methods = [
    PaymentMethod.CARD,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.UPI,
    PaymentMethod.CASH,
    PaymentMethod.OTHER,
  ];

  const recorderIds = [admin.id, staff.id];

  console.log(`Seeding ${TOTAL_PAYMENTS_TO_SEED} payment records in batches...`);
  const batchSize = 1000;
  const batches = Math.ceil(TOTAL_PAYMENTS_TO_SEED / batchSize);
  const now = new Date();

  const invoiceUpdates: Map<string, { paidDelta: number; total: number }> = new Map();

  for (let b = 0; b < batches; b++) {
    const paymentsBatch = [];
    const currentBatchSize = Math.min(batchSize, TOTAL_PAYMENTS_TO_SEED - b * batchSize);

    for (let i = 0; i < currentBatchSize; i++) {
      const idx = (b * batchSize + i) % existingInvoices.length;
      const targetInvoice = existingInvoices[idx];

      const method = methods[(b * batchSize + i) % methods.length];
      const recorderId = recorderIds[(b * batchSize + i) % recorderIds.length];

      // Spread payment dates over past 300 days
      const daysAgo = (b * batchSize + i) % 300;
      const paymentDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Amount between $50 and $250
      const amount = Math.round((50 + ((b * batchSize + i) % 200) + 0.5) * 100) / 100;

      paymentsBatch.push({
        invoiceId: targetInvoice.id,
        recordedById: recorderId,
        amount,
        method,
        paymentDate,
        note: `Payment via ${method} - Batch ${b + 1} #Ref-${b * batchSize + i}`,
      });

      const current = invoiceUpdates.get(targetInvoice.id) || { paidDelta: 0, total: Number(targetInvoice.total) };
      current.paidDelta += amount;
      invoiceUpdates.set(targetInvoice.id, current);
    }

    await prisma.payment.createMany({
      data: paymentsBatch,
    });

    console.log(`  - Inserted batch ${b + 1}/${batches} (${paymentsBatch.length} payments)`);
  }

  // Update amounts paid and status for the affected invoices
  console.log(`Updating ${invoiceUpdates.size} invoices with updated payment totals...`);
  const entries = Array.from(invoiceUpdates.entries());
  const updateChunk = 200;
  for (let c = 0; c < entries.length; c += updateChunk) {
    const chunk = entries.slice(c, c + updateChunk);
    await Promise.all(
      chunk.map(async ([invoiceId, { paidDelta, total }]) => {
        const roundedPaid = Math.min(total, Math.round(paidDelta * 100) / 100);
        const isPaid = roundedPaid >= total;
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: roundedPaid,
            status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.CONFIRMED,
            paidAt: isPaid ? new Date() : undefined,
          },
        });
      })
    );
  }

  const finalPaymentCount = await prisma.payment.count();
  const finalInvoiceCount = await prisma.invoice.count();
  console.log(`✅ P4 Payments Seed Completed.`);
  console.log(`   - Total Payments in DB: ${finalPaymentCount.toLocaleString()} (Requirement: >= 5,000)`);
  console.log(`   - Total Invoices in DB: ${finalInvoiceCount.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

