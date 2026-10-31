import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { registerDailyJob } from '../../shared/scheduler';

export async function autoCloseExpiredSubscriptions(): Promise<{ closedCount: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all ACTIVE subscriptions whose plan has autoClose=true and expiryDate < today
  const expiredSubs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      expiryDate: {
        lt: today,
      },
      plan: {
        autoClose: true,
      },
    },
    select: { id: true, number: true },
  });

  if (expiredSubs.length === 0) {
    return { closedCount: 0 };
  }

  const ids = expiredSubs.map((s) => s.id);

  const result = await prisma.subscription.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      status: SubscriptionStatus.CLOSED,
      closedAt: new Date(),
    },
  });

  console.log(`[AutoCloseJob] Automatically closed ${result.count} expired subscriptions.`);
  return { closedCount: result.count };
}

// Register with daily scheduler
registerDailyJob('autoCloseExpiredSubscriptions', autoCloseExpiredSubscriptions);
