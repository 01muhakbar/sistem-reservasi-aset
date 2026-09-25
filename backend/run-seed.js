const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Seeding...');
  try {
    const kasubdit = await prisma.users.create({
      data: {
        name: 'Kasubdit Rumah Tangga',
        email: 'kasubdit@unhas.ac.id',
        password_hash: 'hashedpassword123',
        role: 'kasubdit',
        department_or_faculty: 'Rektorat',
      }
    });
    
    const panitia = await prisma.users.create({
      data: {
        name: 'Panitia BEM Unhas',
        email: 'panitia@unhas.ac.id',
        password_hash: 'hashedpassword123',
        role: 'requester',
        department_or_faculty: 'BEM Universitas',
      }
    });
    
    const venue = await prisma.venues.create({
      data: {
        name: 'Main Hall Baruga A.P. Pettarani',
        capacity: 1000,
        status: 'active',
      }
    });
    console.log('Seeded successfully!');
  } catch (e) {
    console.error('Error or already seeded:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
