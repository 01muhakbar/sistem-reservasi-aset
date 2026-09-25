import { PrismaClient, UsageType } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Get availability for the calendar
export const getSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { venue_id, start_date, end_date } = req.query;

    const whereClause: any = {
      status: { in: ['locked', 'confirmed'] } // Only show unavailable slots
    };

    if (venue_id) {
      whereClause.venue_id = String(venue_id);
    }
    
    if (start_date && end_date) {
      whereClause.start_time = { gte: new Date(String(start_date)) };
      whereClause.end_time = { lte: new Date(String(end_date)) };
    }

    const schedules = await prisma.schedules.findMany({
      where: whereClause,
      include: {
        booking: {
          select: {
            event_name: true,
            status: true,
            user: {
              select: {
                name: true,
                department_or_faculty: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      message: 'Berhasil mengambil data jadwal.',
      data: schedules
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Terjadi kesalahan saat mengambil jadwal.'
    });
  }
};

export const lockSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      event_name,
      main_event_venue_id,
      main_event_start,
      main_event_end,
      rehearsal_venue_id,
      rehearsal_start,
      rehearsal_end,
      actual_event_start,
      actual_event_end,
      vendors,
      previous_booking_id
    } = req.body;

    if (!user_id || !event_name || !main_event_start) {
      res.status(400).json({ error: 'Data jadwal utama wajib diisi.' });
      return;
    }
    const user = (req as any).user;
    
    // Tahap 2: Role-Based Lead Time Validation
    const mainDateObj = new Date(main_event_start);
    const today = new Date();
    const monthsAhead = (mainDateObj.getFullYear() - today.getFullYear()) * 12 + mainDateObj.getMonth() - today.getMonth();

    if (user.role === 'kasubdit') {
      if (monthsAhead > 12) {
        res.status(403).json({ error: 'Batas maksimal pemesanan institusi adalah 12 bulan ke depan.' });
        return;
      }
    } else {
      if (monthsAhead > 3) {
        res.status(403).json({ error: 'Batas maksimal pemesanan reguler adalah 3 bulan ke depan.' });
        return;
      }
    }

    // Tahap 2: Automated Buffer Time Logic
    // Pemrosesan Hari H (Full-Day)
    // Abaikan jam dari klien, paksa dari 00:01 hingga 23:59
    const mainEndDateObj = new Date(main_event_end || main_event_start);
    const mainEventAbsoluteStart = new Date(mainDateObj.getFullYear(), mainDateObj.getMonth(), mainDateObj.getDate(), 0, 1, 0);
    const mainEventAbsoluteEnd = new Date(mainEndDateObj.getFullYear(), mainEndDateObj.getMonth(), mainEndDateObj.getDate(), 23, 59, 0);
    
    // Pemrosesan Gladi Resik (Time-Slot) - Opt-In
    let gladiStartObj: Date | null = null;
    let gladiEndObj: Date | null = null;
    let gladiAbsoluteStart: Date | null = null;
    let finalGladiSetupBuffer = 0;
    const gladiSetupBuffer = 30; // base buffer
    const gladiTeardownBuffer = 60; // base buffer
    let finalMainTeardownBuffer = gladiTeardownBuffer;
    
    // Vendor Logic
    let maxSetupBuffer = 0;
    let maxTeardownBuffer = 0;
    let vendorSchedules: any[] = [];

    // Hitung akhir acara nyata
    let actualEventEndObj = new Date(mainEventAbsoluteEnd.getTime());
    if (actual_event_end) {
      const [h, m] = actual_event_end.split(':').map(Number);
      actualEventEndObj = new Date(mainEndDateObj.getFullYear(), mainEndDateObj.getMonth(), mainEndDateObj.getDate(), h, m, 0);
    }

    if (rehearsal_start && rehearsal_end) {
      gladiStartObj = new Date(rehearsal_start);
      gladiEndObj = new Date(rehearsal_end);
      
      if (gladiStartObj >= mainEventAbsoluteStart) {
        res.status(400).json({ error: 'Tanggal Gladi Resik harus sebelum Hari H (inkonsistensi kronologi).' });
        return;
      }

      if (vendors && Array.isArray(vendors) && vendors.length > 0) {
        vendors.forEach(v => {
          let l_start: Date;
          let u_start: Date;
          let l_end = gladiStartObj!; 
          let u_end: Date;
          
          if (['RIGGING', 'LED_VIDEOTRON', 'SOUND_SYSTEM', 'LIGHTING', 'SUPPORT_EQUIPMENT'].includes(v.category)) {
            // Vendor Berat
            l_start = new Date(gladiStartObj!.getTime() - 6 * 60 * 60000);
            l_end = gladiStartObj!;
            u_start = new Date(actualEventEndObj.getTime());
            u_end = new Date(actualEventEndObj.getTime() + 6 * 60 * 60000);
          } else {
            // Vendor Ringan
            l_start = new Date(gladiStartObj!.getTime() - 3 * 60 * 60000); 
            l_end = gladiStartObj!;
            u_start = new Date(actualEventEndObj.getTime());
            u_end = new Date(actualEventEndObj.getTime() + 3 * 60 * 60000);
          }

          vendorSchedules.push({
            vendor_category: v.category,
            vendor_name: v.name,
            pic_name: v.pic_name,
            pic_phone: v.pic_phone,
            loading_start: l_start,
            loading_end: l_end,
            unloading_start: u_start,
            unloading_end: u_end,
          });

          // Expand buffers based on lowest loading start and highest unloading end
          // Compared to Gladi Start
          const setupDiff = (gladiStartObj!.getTime() - l_start.getTime()) / 60000;
          if (setupDiff > maxSetupBuffer) maxSetupBuffer = setupDiff;

          // Compared to Main Event End
          const teardownDiff = (u_end.getTime() - mainEventAbsoluteEnd.getTime()) / 60000;
          if (teardownDiff > maxTeardownBuffer) maxTeardownBuffer = teardownDiff;
        });
      }

      finalGladiSetupBuffer = maxSetupBuffer > gladiSetupBuffer ? maxSetupBuffer : gladiSetupBuffer;
      finalMainTeardownBuffer = maxTeardownBuffer > gladiTeardownBuffer ? maxTeardownBuffer : gladiTeardownBuffer;
      gladiAbsoluteStart = new Date(gladiStartObj.getTime() - finalGladiSetupBuffer * 60000);
    }
    const mainEventAbsoluteEndWithBuffer = new Date(mainEventAbsoluteEnd.getTime() + finalMainTeardownBuffer * 60000);

    // Generate Unified Booking ID
    const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 6);
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const booking_code = `BRG-${dateStr}-${randomSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      // Bebaskan jadwal lama jika pengguna mencoba ulang
      if (previous_booking_id) {
        await tx.bookings.deleteMany({
          where: {
            id: previous_booking_id,
            user_id: user_id,
            status: 'pending'
          }
        });
      }

      // Cek ketersediaan Hari H menggunakan rentang absolut
      const mainEventConflict = await tx.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Schedules 
        WHERE venue_id = ${main_event_venue_id} 
          AND status IN ('locked', 'confirmed', 'locked_temporary')
          AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${mainEventAbsoluteEndWithBuffer})
          AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${mainEventAbsoluteStart})
      `;

      console.log('--- CONFLICT CHECK ---');
      console.log('main_event_venue_id:', main_event_venue_id);
      console.log('mainEventAbsoluteStart:', mainEventAbsoluteStart);
      console.log('mainEventAbsoluteEndWithBuffer:', mainEventAbsoluteEndWithBuffer);
      console.log('mainEventConflict Result:', mainEventConflict);
      console.log('----------------------');

      if (Number((mainEventConflict as any)[0].count) > 0) {
        throw new Error('Jadwal Hari H tidak tersedia atau berbenturan dengan waktu logistik acara lain.');
      }

      // Cek ketersediaan Gladi Resik menggunakan rentang absolut
      if (rehearsal_start && rehearsal_end && gladiAbsoluteStart && gladiEndObj) {
        const rehearsalConflict = await tx.$queryRaw`
          SELECT COUNT(*) as count 
          FROM Schedules 
          WHERE venue_id = ${rehearsal_venue_id} 
            AND status IN ('locked', 'confirmed', 'locked_temporary')
            AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${gladiEndObj})
            AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${gladiAbsoluteStart})
        `;

        if (Number((rehearsalConflict as any)[0].count) > 0) {
          throw new Error('Jadwal Gladi Resik tidak tersedia atau berbenturan dengan waktu logistik acara lain.');
        }
      }

      // Buat Draft Booking
      const booking = await tx.bookings.create({
        data: {
          booking_code,
          user_id,
          event_name,
          actual_event_start,
          actual_event_end,
          event_start_date: mainDateObj,
          event_end_date: mainEndDateObj,
          status: 'pending',
          external_logistics_status: req.body.pending_vendor_submission ? 'pending' : (vendors && vendors.length > 0 ? 'submitted' : 'not_required')
        }
      });

      // TTL (Time-to-Live) 15 menit
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const schedulesData: any[] = [];
      let currentLoopDate = new Date(mainEventAbsoluteStart.getTime());
      
      while (currentLoopDate <= mainEventAbsoluteEnd) {
        const loopStart = new Date(currentLoopDate.getFullYear(), currentLoopDate.getMonth(), currentLoopDate.getDate(), 0, 1, 0);
        const loopEnd = new Date(currentLoopDate.getFullYear(), currentLoopDate.getMonth(), currentLoopDate.getDate(), 23, 59, 0);
        
        schedulesData.push({
          booking_id: booking.id,
          venue_id: main_event_venue_id,
          usage_type: UsageType.main_event_fullday,
          start_time: loopStart,
          end_time: loopEnd,
          setup_buffer_minutes: 0,
          teardown_buffer_minutes: 0,
          status: 'locked_temporary',
          expires_at: expiresAt
        });
        
        currentLoopDate.setDate(currentLoopDate.getDate() + 1);
      }

      if (rehearsal_start && rehearsal_end && gladiStartObj && gladiEndObj) {
        schedulesData.push({
          booking_id: booking.id,
          venue_id: rehearsal_venue_id,
          usage_type: UsageType.gladi_timeslot,
          start_time: gladiStartObj,
          end_time: gladiEndObj,
          setup_buffer_minutes: finalGladiSetupBuffer,
          teardown_buffer_minutes: 0,
          status: 'locked_temporary',
          expires_at: expiresAt
        });
      }

      // Lock Temporary
      await tx.schedules.createMany({
        data: schedulesData
      });

      if (vendorSchedules.length > 0) {
        await tx.bookingVendors.createMany({
          data: vendorSchedules.map(v => ({
            booking_id: booking.id,
            ...v
          }))
        });
      }

      return { booking, vendorSchedules };
    });

    res.status(200).json({
      message: 'Jadwal tersedia dan berhasil dikunci sementara.',
      data: result
    });
  } catch (error: any) {
    res.status(409).json({
      error: error.message || 'Terjadi kesalahan saat mengunci jadwal.'
    });
  }
};

export const quickBlock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { start_date, end_date, event_name, venue_id } = req.body;
    const user_id = (req as any).user.id;

    if (!start_date || !end_date || !event_name || !venue_id) {
      res.status(400).json({ error: 'Data institusi wajib diisi.' });
      return;
    }

    const startDate = new Date(start_date);
    startDate.setHours(0, 1, 0, 0);

    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Create a dummy booking for reference
      const booking = await tx.bookings.create({
        data: {
          booking_code: 'VIP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          user_id: user_id,
          event_name: event_name,
          event_description: 'Reservasi VIP Institusi (Quick Block)',
          status: 'approved',
          agreed_to_tos: true,
          agreed_at: new Date()
        }
      });

      // Create schedule directly as 'confirmed'
      const schedule = await tx.schedules.create({
        data: {
          booking_id: booking.id,
          venue_id: venue_id,
          usage_type: UsageType.main_event_fullday,
          start_time: startDate,
          end_time: endDate,
          status: 'confirmed'
        }
      });
      return { booking, schedule };
    });

    res.status(201).json({ message: 'Berhasil mengunci tanggal institusi.', data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengunci jadwal institusi.' });
  }
};
