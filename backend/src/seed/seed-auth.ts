import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { prisma } from '../shared/db';

async function main() {
  const isClean = process.argv.includes('--clean');

  const beforeTotal = await prisma.user.count();
  console.log(`[seed:auth] Current total users in DB before run: ${beforeTotal}`);

  if (isClean) {
    console.log('[seed:auth] Cleaning previously seeded auth users (ending in @brightloop.test)...');
    const deleted = await prisma.user.deleteMany({
      where: {
        email: { endsWith: '@brightloop.test' },
      },
    });
    console.log(`[seed:auth] Cleaned ${deleted.count} seeded users.`);
    const afterClean = await prisma.user.count();
    console.log(`[seed:auth] Remaining users in DB: ${afterClean}`);
    return;
  }

  // Check if seed data already exists
  const existingSeedCount = await prisma.user.count({
    where: { email: { endsWith: '@brightloop.test' } },
  });

  if (existingSeedCount >= 5036) {
    console.log(`[seed:auth] Seed users already exist (${existingSeedCount} found). Skipping insertion to avoid duplicates.`);
    return;
  }

  console.log('[seed:auth] Hashing dev password once for high-performance batch seeding...');
  const devPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(devPassword, 10);

  const usersToInsert: Array<{
    email: string;
    passwordHash: string;
    name: string;
    role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
    companyName: string | null;
    phone: string | null;
    billingAddress: string | null;
    isActive: boolean;
  }> = [];

  // 1 Admin
  usersToInsert.push({
    email: 'seed+admin@brightloop.test',
    passwordHash,
    name: 'Seeded Admin User',
    role: 'ADMIN',
    companyName: 'Brightloop Software',
    phone: '+1-555-0100',
    billingAddress: '100 Brightloop Way, Tech Park',
    isActive: true,
  });

  // 15 Staff
  for (let i = 1; i <= 15; i++) {
    usersToInsert.push({
      email: `seed+staff${i}@brightloop.test`,
      passwordHash,
      name: `Seeded Staff Member ${i}`,
      role: 'STAFF',
      companyName: 'Brightloop Support',
      phone: `+1-555-02${i.toString().padStart(2, '0')}`,
      billingAddress: '100 Brightloop Way, Tech Park',
      isActive: true,
    });
  }

  // 5,020 Customers (Total users = 5,036)
  const customerCount = 5020;
  for (let i = 1; i <= customerCount; i++) {
    usersToInsert.push({
      email: `seed+cust${i}@brightloop.test`,
      passwordHash,
      name: `Customer ${i} Corporation`,
      role: 'CUSTOMER',
      companyName: `Company ${i} Inc`,
      phone: `+1-555-10${(i % 1000).toString().padStart(4, '0')}`,
      billingAddress: `${i} Commerce Blvd, Suite ${i % 100}`,
      isActive: true,
    });
  }

  console.log(`[seed:auth] Prepared ${usersToInsert.length} users. Inserting in batches of 500...`);

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < usersToInsert.length; i += batchSize) {
    const batch = usersToInsert.slice(i, i + batchSize);
    const result = await prisma.user.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    process.stdout.write(`  Inserted ${inserted}/${usersToInsert.length}...\r`);
  }

  console.log(`\n[seed:auth] Seeding completed! Successfully inserted ${inserted} users.`);
  const afterTotal = await prisma.user.count();
  console.log(`[seed:auth] New total users in DB: ${afterTotal}`);
}

main()
  .catch((err) => {
    console.error('[seed:auth] Error during seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
