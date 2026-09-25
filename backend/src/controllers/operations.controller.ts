import { PrismaClient, BookingStatus, ReputationFlag, CleanlinessStatus } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// GET /api/operations/daily-roster
// Fetch APPROVED bookings where start_time is in the next 0-48 hours
export const getDailyRoster = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    // 7 days from now (diperluas sementara dari 48 jam untuk keperluan testing)
    const next48Hours = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const schedules = await prisma.schedules.findMany({
      where: {
        booking: {
          status: BookingStatus.approved,
        },
        start_time: {
          gte: now,
          lte: next48Hours,
        },
      },
      include: {
        venue: true,
        booking: {
          include: {
            user: {
              select: { name: true, department_or_faculty: true, reputation_flag: true }
            },
            inventories: {
              include: { inventory: true }
            },
            vendors: true,
            inspectionReport: true
          }
        }
      },
      orderBy: {
        start_time: 'asc'
      }
    });

    res.status(200).json({ data: schedules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/operations/inventories
// Get all available inventories
export const getInventories = async (req: Request, res: Response): Promise<void> => {
  try {
    const inventories = await prisma.inventories.findMany();
    res.status(200).json({ data: inventories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/operations/inventories/allocate
// Allocate extra inventory to a booking
export const allocateInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, inventory_id, quantity } = req.body;

    if (!booking_id || !inventory_id || !quantity) {
      res.status(400).json({ error: 'Data booking_id, inventory_id, dan quantity wajib diisi.' });
      return;
    }

    // Ambil data inventory master
    const inventory = await prisma.inventories.findUnique({ where: { id: inventory_id } });
    if (!inventory) {
      res.status(404).json({ error: 'Barang tidak ditemukan.' });
      return;
    }

    // Ambil semua peminjaman barang ini yang overlap dengan jadwal booking saat ini.
    // Untuk sederhana (dan mengurangi query kompleks), kita ambil total dipinjam dari Bookings yang Approved.
    // Dalam implementasi nyata, kita harus cek overlap Schedule.
    
    // Namun instruksi cukup: total_quantity dikurangi SUM(quantity_borrowed) pada rentang time-slot yang sama.
    // Mari kita sederhanakan: ambil Booking yg dituju untuk tau rentang waktu acara utamanya
    const targetBooking = await prisma.bookings.findUnique({
      where: { id: booking_id },
      include: { schedules: true }
    });
    
    if (!targetBooking || targetBooking.schedules.length === 0) {
      res.status(404).json({ error: 'Booking tidak ditemukan atau tidak memiliki jadwal.' });
      return;
    }

    // Cari jadwal utama
    const mainSchedule = targetBooking.schedules.find(s => s.usage_type === 'main_event_fullday' || s.usage_type === 'main_event_halfday') || targetBooking.schedules[0];
    const { start_time, end_time } = mainSchedule;

    // Cari booking lain yang menggunakan inventory ini pada waktu yang overlap
    const overlappingBookings = await prisma.schedules.findMany({
      where: {
        booking: {
          status: BookingStatus.approved,
          inventories: {
            some: { inventory_id }
          }
        },
        start_time: { lt: end_time },
        end_time: { gt: start_time },
      },
      include: {
        booking: {
          include: {
            inventories: { where: { inventory_id } }
          }
        }
      }
    });

    let totalBorrowed = 0;
    // Hindari double count jika satu booking punya banyak schedule yang overlap
    const seenBookingIds = new Set<string>();
    for (const schedule of overlappingBookings) {
      if (!seenBookingIds.has(schedule.booking_id)) {
        seenBookingIds.add(schedule.booking_id);
        const inv = schedule.booking.inventories.find(i => i.inventory_id === inventory_id);
        if (inv) totalBorrowed += inv.quantity_borrowed;
      }
    }

    const availableStock = inventory.total_quantity - totalBorrowed;
    if (quantity > availableStock) {
      res.status(400).json({ error: `Stok tidak mencukupi pada rentang waktu ini. Sisa stok riil: ${availableStock}` });
      return;
    }

    // Upsert alokasi
    const allocation = await prisma.bookingInventories.upsert({
      where: {
        booking_id_inventory_id: { booking_id, inventory_id }
      },
      update: {
        quantity_borrowed: quantity
      },
      create: {
        booking_id,
        inventory_id,
        quantity_borrowed: quantity
      }
    });

    res.status(200).json({ message: 'Alokasi inventaris berhasil disimpan.', data: allocation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/operations/bap
// Create Inspection Report (BAP)
export const submitBAP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, cleanliness_status, facility_damage_details, photo_evidence_urls, violating_vendor_name } = req.body;
    // Di aplikasi nyata, inspector_id didapat dari token req.user.id
    // Namun untuk sekarang kita mock dengan ID user pertama yang rolenya 'pengelola' atau bebas.

    if (!booking_id || !cleanliness_status || !photo_evidence_urls) {
      res.status(400).json({ error: 'booking_id, cleanliness_status, dan photo_evidence_urls wajib diisi.' });
      return;
    }

    let pengelola = await prisma.users.findFirst({ where: { role: 'pengelola' } });
    if (!pengelola) {
       // Fallback untuk mock jika admin lupa bikin akun pengelola
       pengelola = await prisma.users.findFirst({ where: { role: 'kasubdit' } });
    }

    const report = await prisma.inspectionReports.create({
      data: {
        booking_id,
        inspector_id: pengelola!.id,
        cleanliness_status: cleanliness_status as CleanlinessStatus,
        facility_damage_details,
        photo_evidence_urls: JSON.stringify(photo_evidence_urls),
        violating_vendor_name: violating_vendor_name || null,
      }
    });

    // Otomatisasi Flagging (Reputation Loop)
    if (cleanliness_status === 'dirty' || cleanliness_status === 'damaged') {
      // Jika ada vendor spesifik yang melanggar, kita cukup mencatat di BAP (untuk database vendor internal),
      // namun kita tidak menghukum (blacklist) mahasiswa secara langsung kecuali mereka tidak kooperatif.
      if (!violating_vendor_name) {
        const booking = await prisma.bookings.findUnique({ where: { id: booking_id } });
        if (booking) {
          await prisma.users.update({
            where: { id: booking.user_id },
            data: {
              reputation_flag: cleanliness_status === 'damaged' ? ReputationFlag.blacklisted : ReputationFlag.warning
            }
          });
        }
      }
    }

    res.status(201).json({ message: 'BAP berhasil dilaporkan.', data: report });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'BAP untuk booking ini sudah pernah dibuat sebelumnya.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

// PATCH /api/operations/vendors/:id/status
// Toggle Gatepass Vendor Status
export const updateVendorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendor_id = (req.params.id as string);
    const { check_in_status } = req.body;

    if (!['MENUNGGU', 'DI_LOKASI', 'SELESAI'].includes(check_in_status)) {
      res.status(400).json({ error: 'check_in_status tidak valid. Harus MENUNGGU, DI_LOKASI, atau SELESAI.' });
      return;
    }

    const updatedVendor = await prisma.bookingVendors.update({
      where: { id: vendor_id },
      data: { check_in_status }
    });

    res.status(200).json({ 
      message: 'Status check-in vendor berhasil diperbarui.',
      data: updatedVendor 
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Vendor tidak ditemukan.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};
