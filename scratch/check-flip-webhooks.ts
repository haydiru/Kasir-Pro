import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Flip Webhooks in DB ---');
  const count = await prisma.flipWebhook.count();
  console.log(`Total webhooks stored: ${count}`);
  
  const webhooks = await prisma.flipWebhook.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log('Latest 10 entries:');
  webhooks.forEach(w => {
    console.log(`- ID: ${w.id}\n  FlipID: ${w.flipId}\n  Nominal: ${w.nominal}\n  Time: ${w.transactionTime.toISOString()}\n  Store: ${w.storeId}\n  Subject: ${w.emailSubject}\n  CreatedAt: ${w.createdAt.toISOString()}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
