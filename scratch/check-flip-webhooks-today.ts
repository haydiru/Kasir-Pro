import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Flip Webhooks Created Today ---');
  // Today in Jakarta (UTC+7) starts at 2026-07-04T17:00:00.000Z
  const todayStart = new Date('2026-07-04T17:00:00.000Z');
  
  const webhooks = await prisma.flipWebhook.findMany({
    where: {
      createdAt: { gte: todayStart }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${webhooks.length} webhooks created today:`);
  webhooks.forEach(w => {
    console.log(`- ID: ${w.id}\n  FlipID: ${w.flipId}\n  Nominal: ${w.nominal}\n  Time: ${w.transactionTime.toISOString()}\n  Subject: ${w.emailSubject}\n  CreatedAt: ${w.createdAt.toISOString()}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
