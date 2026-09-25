const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  try {
    await prisma.$executeRaw`UPDATE BookingVendors SET check_in_status = 'MENUNGGU'`;
    console.log("Database fixed!");
  } catch(e) {
    console.error(e);
  }
}
fix();
