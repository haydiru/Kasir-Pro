import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Detailed Database Check ---');
  
  const stores = await prisma.store.findMany();
  console.log(`Stores (${stores.length}):`);
  stores.forEach(s => console.log(`- ${s.name} (${s.id})`));

  const users = await prisma.user.findMany();
  console.log(`\nUsers (${users.length}):`);
  users.forEach(u => console.log(`- ${u.name} [${u.role}] (Store ID: ${u.storeId})`));

  const reports = await prisma.shiftReport.findMany();
  console.log(`\nReports (${reports.length}):`);
  reports.forEach(r => console.log(`- Report ID: ${r.id}, Date: ${r.date}, Shift: ${r.shiftType}, Status: ${r.status}, Store ID: ${r.storeId}`));

  const attendance = await prisma.attendance.findMany();
  console.log(`\nAttendance Logs (${attendance.length}):`);
  
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
