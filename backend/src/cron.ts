import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Run every 1 minute
export const startCronJobs = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find expired schedules
      const expiredSchedules = await prisma.schedules.findMany({
        where: {
          status: 'locked_temporary',
          expires_at: {
            lt: now
          }
        },
        select: { id: true, booking_id: true }
      });

      if (expiredSchedules.length > 0) {
        const scheduleIds = expiredSchedules.map(s => s.id);
        const bookingIds = [...new Set(expiredSchedules.map(s => s.booking_id))];

        // Delete expired schedules
        await prisma.schedules.deleteMany({
          where: {
            id: { in: scheduleIds }
          }
        });

        // Optional: Delete orphaned draft bookings if they have no other schedules
        for (const bookingId of bookingIds) {
          const remainingSchedules = await prisma.schedules.count({
            where: { booking_id: bookingId }
          });
          
          if (remainingSchedules === 0) {
            await prisma.bookings.delete({
              where: { id: bookingId }
            });
          }
        }
        
        console.log(`[Garbage Collection] Removed ${scheduleIds.length} expired temporary schedules.`);
      }
    } catch (error) {
      console.error('[Garbage Collection] Error cleaning up expired schedules:', error);
    }
  });

  // Run daily at 01:00 AM for Vendor Deadlines
  cron.schedule('0 1 * * *', async () => {
    try {
      const now = new Date();
      
      const upcomingBookings = await prisma.bookings.findMany({
        where: {
          external_logistics_status: 'pending',
          status: 'approved'
        },
        include: {
          schedules: {
            where: { usage_type: 'main_event_fullday' }
          },
          user: true
        }
      });

      for (const booking of upcomingBookings) {
        if (!booking.schedules[0]) continue;
        const mainEventDate = new Date(booking.schedules[0].start_time);
        const daysDiff = (mainEventDate.getTime() - now.getTime()) / (1000 * 3600 * 24);

        if (daysDiff <= 3 && daysDiff >= 0) {
          // Reject logistics
          await prisma.bookings.update({
            where: { id: booking.id },
            data: { external_logistics_status: 'rejected' }
          });
          console.log(`[Vendor Deadline] Izin logistik eksternal DIBATALKAN untuk booking ${booking.booking_code} (Melewati H-3).`);
        } else if (daysDiff <= 14 && daysDiff > 3) {
          // Send warning
          console.log(`[Vendor Warning] Email terkirim ke ${booking.user?.email || 'User'}: Harap lengkapi manifesto vendor acara ${booking.event_name} sebelum H-3.`);
        }
      }
    } catch (error) {
      console.error('[Vendor Deadline] Error checking vendor deadlines:', error);
    }
  });

  // Run daily at 15:00 WITA (07:00 UTC if server is UTC, or adjust accordingly. Assuming local time here 15:00)
  // For Pengelola: Loading dock preparation for tomorrow
  cron.schedule('0 15 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const tomorrowSchedules = await prisma.schedules.findMany({
        where: {
          start_time: {
            gte: tomorrow,
            lte: endOfTomorrow
          },
          status: 'confirmed',
          booking: {
            external_logistics_status: { not: 'not_required' }
          }
        },
        include: {
          booking: true
        }
      });

      if (tomorrowSchedules.length > 0) {
        // Send notification to PENGELOLA
        // Since it's a script, we import createNotification dynamically or at the top
        const { createNotification } = require('./services/notification.service');
        
        await createNotification({
          role_target: 'PENGELOLA',
          title: 'Persiapan Loading Dock',
          message: `Terdapat ${tomorrowSchedules.length} jadwal dengan logistik eksternal esok hari. Mohon persiapkan Loading Dock.`,
          action_url: '/pengelola/dashboard',
          urgency: 'MEDIUM'
        });
        
        console.log(`[Pengelola Alert] Sent notification for ${tomorrowSchedules.length} schedules tomorrow.`);
      }
    } catch (error) {
      console.error('[Pengelola Alert] Error checking tomorrow schedules:', error);
    }
  });
};
