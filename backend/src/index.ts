import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
export const prisma = new PrismaClient();

// Validasi Lapis ke-3 (Prisma Middleware / Hook)
prisma.$use(async (params, next) => {
  if (params.model === 'Schedules' && (params.action === 'create' || params.action === 'createMany')) {
    const schedules = params.action === 'create' ? [params.args.data] : params.args.data;
    
    for (const schedule of schedules) {
      if (!schedule.start_time || !schedule.end_time || !schedule.venue_id) continue;
      
      const setup = schedule.setup_buffer_minutes || 0;
      const teardown = schedule.teardown_buffer_minutes || 0;
      
      const newAbsoluteStart = new Date(new Date(schedule.start_time).getTime() - setup * 60000);
      const newAbsoluteEnd = new Date(new Date(schedule.end_time).getTime() + teardown * 60000);
      
      const conflict: any = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Schedules 
        WHERE venue_id = ${schedule.venue_id}
          AND status IN ('locked', 'confirmed', 'locked_temporary')
          AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${newAbsoluteEnd})
          AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${newAbsoluteStart})
      `;
      
      if (Number(conflict[0].count) > 0) {
        throw new Error('Validasi Lapis 3 (Prisma Hook): Terdeteksi jadwal bayangan / bentrokan waktu logistik.');
      }
    }
  }
  return next(params);
});

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

import { createBundledBooking, approveBooking, getBookings, finalizeBooking, rejectBooking, revokeBooking, getMyBookings, getPdfBooking, trackBooking, rescheduleBooking } from './controllers/booking.controller';
import { getSchedules, lockSchedule, quickBlock } from './controllers/schedule.controller';
import { loginPublic, loginSSO, registerPublic, forgotPassword, resetPassword, getMe, logout } from './controllers/auth.controller';
import { getPendingKycUsers, verifyKyc } from './controllers/user.controller';
import { getDailyRoster, getInventories, allocateInventory, submitBAP, updateVendorStatus } from './controllers/operations.controller';
import { getSettings, updateSettings } from './controllers/settings.controller';
import { streamNotifications, getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification } from './controllers/notification.controller';
import { requireAuth, requireRole } from './middlewares/auth.middleware';
import { publicAuthLimiter } from './middlewares/rateLimiter';
import { startCronJobs } from './cron';

// Jalankan Garbage Collection (Cron Jobs)
startCronJobs();

// Routes
// Auth Routes
app.post('/api/auth/login-public', publicAuthLimiter, loginPublic);
app.post('/api/auth/login-sso', loginSSO);
app.post('/api/auth/register-public', publicAuthLimiter, registerPublic);
app.post('/api/auth/forgot-password', publicAuthLimiter, forgotPassword);
app.post('/api/auth/reset-password', publicAuthLimiter, resetPassword);
app.get('/api/auth/me', requireAuth, getMe);
app.post('/api/auth/logout', logout);

// Schedule Routes
app.get('/api/schedules/availability', getSchedules);
app.post('/api/schedules/lock', requireAuth, requireRole(['mahasiswa', 'fakultas', 'umum_komersial']), lockSchedule);
app.post('/api/schedules/quick-block', requireAuth, requireRole(['kasubdit']), quickBlock);

app.get('/api/bookings/my-bookings', requireAuth, requireRole(['mahasiswa', 'fakultas', 'umum_komersial']), getMyBookings);
app.get('/api/bookings/track/:bookingCode', trackBooking);
app.get('/api/bookings/:id/pdf', requireAuth, getPdfBooking);

app.get('/api/bookings', requireAuth, requireRole(['kasubdit']), getBookings);
app.post('/api/bookings', requireAuth, requireRole(['mahasiswa', 'fakultas', 'umum_komersial']), createBundledBooking);
app.put('/api/bookings/:id/finalize', requireAuth, requireRole(['mahasiswa', 'fakultas', 'umum_komersial']), finalizeBooking);
app.put('/api/bookings/:id/approve', requireAuth, requireRole(['kasubdit']), approveBooking);
app.put('/api/bookings/:id/reject', requireAuth, requireRole(['kasubdit']), rejectBooking);
app.put('/api/bookings/:id/revoke', requireAuth, requireRole(['kasubdit']), revokeBooking);
app.post('/api/bookings/:id/reschedule', requireAuth, requireRole(['mahasiswa', 'fakultas', 'umum_komersial']), rescheduleBooking);

// Notification Routes

app.get('/api/notifications/stream', requireAuth, streamNotifications);
app.get('/api/notifications/unread-count', requireAuth, getUnreadCount);
app.get('/api/notifications', requireAuth, getNotifications);
app.patch('/api/notifications/read-all', requireAuth, markAllAsRead);
app.patch('/api/notifications/:id/read', requireAuth, markAsRead);
app.delete('/api/notifications/:id', requireAuth, deleteNotification);

// KYC Routes
app.get('/api/users/kyc/pending', requireAuth, requireRole(['kasubdit']), getPendingKycUsers);
app.put('/api/users/kyc/:id/verify', requireAuth, requireRole(['kasubdit']), verifyKyc);

// Operations & Inventory (Pengelola)
app.get('/api/operations/daily-roster', requireAuth, requireRole(['pengelola', 'kasubdit']), getDailyRoster);
app.get('/api/operations/inventories', requireAuth, requireRole(['pengelola']), getInventories);
app.post('/api/operations/inventories/allocate', requireAuth, requireRole(['pengelola']), allocateInventory);
app.post('/api/operations/bap', requireAuth, requireRole(['pengelola']), submitBAP);
app.patch('/api/operations/vendors/:id/status', requireAuth, requireRole(['pengelola', 'kasubdit']), updateVendorStatus);

// Settings
app.get('/api/settings/:key', getSettings);
app.put('/api/settings/:key', requireAuth, requireRole(['kasubdit']), updateSettings);


// Helper for frontend to get default user and venue
app.get('/api/seed-data', async (req, res) => {
  try {
    const user = await prisma.users.findFirst({ where: { role: 'mahasiswa' } });
    const venue = await prisma.venues.findFirst();
    res.json({ user, venue });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
