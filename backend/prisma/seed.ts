import { PrismaClient, Role, VenueStatus } from '@prisma/client';

import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');
  
  const password_hash = await bcrypt.hash('password123', 10);

  // Create Kasubdit User
  const kasubdit = await prisma.users.upsert({
    where: { email: 'kasubdit@unhas.ac.id' },
    update: {},
    create: {
      name: 'Kasubdit Rumah Tangga',
      email: 'kasubdit@unhas.ac.id',
      password_hash,
      role: Role.kasubdit,
      department_or_faculty: 'Rektorat',
    },
  });
  console.log('Kasubdit created:', kasubdit.email);

  // Create Pengelola User
  const pengelola = await prisma.users.upsert({
    where: { email: 'pengelola@unhas.ac.id' },
    update: {},
    create: {
      name: 'Pengelola Fasilitas & Logistik',
      email: 'pengelola@unhas.ac.id',
      password_hash,
      role: Role.pengelola,
      department_or_faculty: 'Manajemen Fasilitas',
    },
  });
  console.log('Pengelola created:', pengelola.email);

  // Create Mahasiswa User
  const panitia = await prisma.users.upsert({
    where: { email: 'hmti@unhas.ac.id' },
    update: {},
    create: {
      name: 'Panitia HMTI Unhas',
      email: 'hmti@unhas.ac.id',
      password_hash,
      role: Role.mahasiswa,
      department_or_faculty: 'Fakultas Teknik',
    },
  });
  console.log('Mahasiswa created:', panitia.email);

  // Create Venue
  const venue = await prisma.venues.upsert({
    where: { name: 'Main Hall Baruga A.P. Pettarani' },
    // Assuming we just clear and seed or don't worry about duplicates for this basic seed
    update: {},
    create: {
      name: 'Main Hall Baruga A.P. Pettarani',
      capacity: 1000,
      status: VenueStatus.active,
    },
  });
  console.log('Venue created:', venue.name);

  // Create Inventories
  const inv1 = await prisma.inventories.upsert({
    where: { id: 'inv-kursi-vvip' },
    update: {},
    create: {
      id: 'inv-kursi-vvip',
      item_name: 'Kursi VVIP',
      total_quantity: 100,
    }
  });
  
  const inv2 = await prisma.inventories.upsert({
    where: { id: 'inv-mic-wireless' },
    update: {},
    create: {
      id: 'inv-mic-wireless',
      item_name: 'Mic Wireless',
      total_quantity: 10,
    }
  });
  console.log('Inventories created');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
