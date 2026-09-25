import { PrismaClient, UsageType } from '@prisma/client';
import { Request, Response } from 'express';
import PDFDocument from 'pdfkit-table';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const prisma = new PrismaClient();
import { createNotification } from '../services/notification.service';

// Create a new booking with bundled schedules (Hari H and Gladi Resik)
export const createBundledBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      event_name,
      event_description,
      document_url,
      agreed_to_tos,
      main_event_venue_id,
      main_event_start,
      main_event_end,
      rehearsal_venue_id,
      rehearsal_start,
      rehearsal_end,
    } = req.body;

    // Validate required fields
    if (!user_id || !event_name || !main_event_venue_id || !main_event_start || !main_event_end) {
      res.status(400).json({ error: 'Semua field jadwal dan data event wajib diisi.' });
      return;
    }

    if (!agreed_to_tos) {
      res.status(400).json({ error: 'Anda harus menyetujui Syarat dan Ketentuan SOP sebelum mengajukan.' });
      return;
    }

    const user = await prisma.users.findUnique({ where: { id: user_id } });
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    if (user.role === 'umum_komersial' && user.kyc_status === 'PENDING') {
      res.status(403).json({ error: 'Akun Anda sedang ditinjau. Anda belum bisa melakukan pemesanan (Pending KYC).' });
      return;
    }

    // Generate Unified Booking ID (e.g. BRG-202608-UUID)
    const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 6);
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const booking_code = `BRG-${dateStr}-${randomSuffix}`;

    // Execute Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check Availability for Main Event
      const mainEventConflict = await tx.schedules.findFirst({
        where: {
          venue_id: main_event_venue_id,
          status: { in: ['locked', 'confirmed'] },
          OR: [
            { start_time: { lt: new Date(main_event_end), gte: new Date(main_event_start) } },
            { end_time: { gt: new Date(main_event_start), lte: new Date(main_event_end) } }
          ]
        }
      });

      if (mainEventConflict) {
        throw new Error('Jadwal Hari H sudah terisi.');
      }

      // 2. Check Availability for Rehearsal (Gladi Resik) - Opt-In
      if (rehearsal_start && rehearsal_end && rehearsal_venue_id) {
        const rehearsalConflict = await tx.schedules.findFirst({
          where: {
            venue_id: rehearsal_venue_id,
            status: { in: ['locked', 'confirmed'] },
            OR: [
              { start_time: { lt: new Date(rehearsal_end), gte: new Date(rehearsal_start) } },
              { end_time: { gt: new Date(rehearsal_start), lte: new Date(rehearsal_end) } }
            ]
          }
        });

        if (rehearsalConflict) {
          throw new Error('Jadwal Gladi Resik sudah terisi.');
        }
      }

      // 3. Create Master Booking
      const booking = await tx.bookings.create({
        data: {
          booking_code,
          user_id,
          event_name,
          event_description,
          document_url,
          status: 'pending',
          agreed_to_tos: true,
          agreed_at: new Date()
        }
      });

      // 4. Create Main Event Schedule(s) - Supports Multi-day
      let currentDate = new Date(main_event_start);
      const end_date_adjusted = new Date(main_event_end);
      
      while (currentDate <= end_date_adjusted) {
        let currentLoopDate = new Date(currentDate.getTime());
        let dailyStart = new Date(currentLoopDate.setHours(0, 1, 0, 0));
        let dailyEnd = new Date(currentLoopDate.setHours(23, 59, 0, 0));

        await tx.schedules.create({
          data: {
            booking_id: booking.id,
            venue_id: main_event_venue_id,
            usage_type: UsageType.main_event_fullday,
            start_time: dailyStart,
            end_time: dailyEnd,
            status: 'locked'
          }
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 5. Create Rehearsal Schedule - Opt-In
      if (rehearsal_start && rehearsal_end && rehearsal_venue_id) {
        await tx.schedules.create({
          data: {
            booking_id: booking.id,
            venue_id: rehearsal_venue_id,
            usage_type: UsageType.gladi_timeslot,
            start_time: new Date(rehearsal_start),
            end_time: new Date(rehearsal_end),
            status: 'locked'
          }
        });
      }

      // 6. Log Activity
      await tx.activityLogs.create({
        data: {
          booking_id: booking.id,
          actor_id: user_id,
          action_type: 'CREATED',
          details: `Pengguna membuat pengajuan booking ${rehearsal_start ? 'terintegrasi (Hari H & Gladi Resik)' : '(Hanya Hari H)'}.`
        }
      });

      return booking;
    });
    await createNotification({
      role_target: 'KASUBDIT',
      title: 'Persetujuan Diperlukan',
      message: `Pengajuan ${result.event_name} menunggu verifikasi Anda.`,
      action_url: `/admin?highlight=${result.booking_code}`,
      urgency: 'MEDIUM'
    });

    res.status(201).json({
      message: 'Booking berhasil diajukan dengan status Pending.',
      data: result
    });
  } catch (error: any) {
    res.status(409).json({
      error: error.message || 'Terjadi kesalahan saat memproses booking.'
    });
  }
};

// Finalize Booking (Ubah dari locked_temporary ke locked, simpan dokumen)
export const finalizeBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { document_url } = req.body;

    if (!document_url) {
      res.status(400).json({ error: 'Dokumen permohonan wajib diunggah.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.bookings.findUnique({ where: { id: id as string } });
      if (!booking) throw new Error('Booking tidak ditemukan atau sesi telah kedaluwarsa.');

      // Update Booking
      const updatedBooking = await tx.bookings.update({
        where: { id: id as string },
        data: { document_url, status: 'pending' }
      });

      // Update Schedules (Remove Temporary Lock)
      await tx.schedules.updateMany({
        where: { booking_id: id as string },
        data: { status: 'locked', expires_at: null }
      });

      // Log Activity
      await tx.activityLogs.create({
        data: {
          booking_id: id as string,
          actor_id: booking.user_id,
          action_type: 'CREATED',
          details: 'Pengguna menyelesaikan pengajuan booking dan mengunggah dokumen.'
        }
      });

      return updatedBooking;
    });

    // Notifikasi ke Kasubdit & Pengelola
    const admins = await prisma.users.findMany({
      where: { role: { in: ['pengelola', 'kasubdit'] } },
      select: { id: true, role: true }
    });

    for (const admin of admins) {
      await createNotification({
        role_target: admin.role === 'kasubdit' ? 'KASUBDIT' : 'PENGELOLA',
        user_id: admin.id,
        title: 'Pengajuan Baru',
        message: `Terdapat pengajuan baru (${result.booking_code}) yang membutuhkan tinjauan.`,
        action_url: admin.role === 'kasubdit' ? '/admin' : '/pengelola/dashboard',
        urgency: 'HIGH'
      });
    }

    res.status(200).json({
      message: 'Booking berhasil diajukan secara final.',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Terjadi kesalahan saat memfinalisasi booking.'
    });
  }
};

// 1-Click Action for Kasubdit
export const approveBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { kasubdit_id } = req.body; // Mocking kasubdit ID for now

    if (!kasubdit_id) {
      res.status(400).json({ error: 'kasubdit_id diperlukan.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Booking Status
      const updatedBooking = await tx.bookings.update({
        where: { id: id as string },
        data: { status: 'approved' }
      });

      // 2. Update Schedules Status
      await tx.schedules.updateMany({
        where: { booking_id: id as string },
        data: { status: 'confirmed' }
      });

      // 3. Log Activity
      await tx.activityLogs.create({
        data: {
          booking_id: id as string,
          actor_id: kasubdit_id,
          action_type: 'APPROVED',
          details: 'Kasubdit menyetujui jadwal gladi dan hari H.'
        }
      });

      return updatedBooking;
    });

    await createNotification({
      user_id: result.user_id,
      role_target: 'PENGGUNA',
      title: 'Pengajuan Disetujui',
      message: `Pengajuan ${result.event_name} Anda telah disetujui.`,
      action_url: `/track/${result.booking_code}`,
      urgency: 'LOW'
    });

    await createNotification({
      role_target: 'PENGELOLA',
      title: 'Agenda Baru Disetujui',
      message: `Kasubdit telah menyetujui ${result.event_name}. Persiapkan lapangan.`,
      action_url: `/pengelola/dashboard`,
      urgency: 'MEDIUM'
    });

    res.status(200).json({
      message: 'Booking berhasil disetujui.',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Terjadi kesalahan saat memproses persetujuan.'
    });
  }
};

// Get all bookings for Admin Dashboard
export const getBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;
    const whereClause: any = {};

    if (status && status !== 'all') {
      whereClause.status = String(status);
    }

    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { event_name: { contains: searchStr } },
        { booking_code: { contains: searchStr } }
      ];
    }

    const bookings = await prisma.bookings.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, department_or_faculty: true, reputation_flag: true } },
        schedules: { select: { usage_type: true, start_time: true, end_time: true, setup_buffer_minutes: true, teardown_buffer_minutes: true } },
        vendors: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({
      message: 'Berhasil mengambil daftar booking.',
      data: bookings
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Terjadi kesalahan saat mengambil daftar booking.'
    });
  }
};

// Reject Booking (Exception Handling)
export const rejectBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { admin_notes, kasubdit_id } = req.body;

    if (!kasubdit_id || !admin_notes) {
      res.status(400).json({ error: 'kasubdit_id dan admin_notes (catatan penolakan) diperlukan.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: id as string },
        data: { status: 'rejected', admin_notes }
      });

      await tx.schedules.updateMany({
        where: { booking_id: id as string },
        data: { status: 'released' }
      });

      await tx.activityLogs.create({
        data: {
          booking_id: id as string,
          actor_id: kasubdit_id,
          action_type: 'REJECTED',
          details: `Kasubdit menolak pengajuan. Catatan: ${admin_notes}`
        }
      });

      return updatedBooking;
    });

    await createNotification({
      user_id: result.user_id,
      role_target: 'PENGGUNA',
      title: 'Pengajuan Ditolak',
      message: `Pengajuan ${result.event_name} ditolak. Alasan: ${result.admin_notes}`,
      action_url: `/track/${result.booking_code}`,
      urgency: 'HIGH'
    });

    res.status(200).json({ message: 'Booking berhasil ditolak.', data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Terjadi kesalahan saat memproses penolakan.' });
  }
};

// Revoke Booking (Force Majeure)
export const revokeBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { kasubdit_id, reason } = req.body;

    if (!kasubdit_id) {
      res.status(400).json({ error: 'kasubdit_id diperlukan.' });
      return;
    }

    if (!reason || reason.trim() === '') {
      res.status(400).json({ error: 'Alasan pencabutan (reason) wajib diisi.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: id as string },
        data: { status: 'revoked', admin_notes: `Dibatalkan paksa (Force Majeure). Alasan: ${reason}` }
      });

      await tx.schedules.deleteMany({
        where: { booking_id: id as string }
      });

      await tx.activityLogs.create({
        data: {
          booking_id: id as string,
          actor_id: kasubdit_id,
          action_type: 'REVOKED',
          details: `Kasubdit membatalkan jadwal yang telah disetujui (Force Majeure). Alasan: ${reason}`
        }
      });

      return updatedBooking;
    });

    await createNotification({
      user_id: result.user_id,
      role_target: 'PENGGUNA',
      title: 'Persetujuan Dicabut (Force Majeure)',
      message: `Persetujuan ${result.event_name} terpaksa dicabut. Alasan: ${reason}. Silakan ajukan reschedule.`,
      action_url: `/track/${result.booking_code}`,
      urgency: 'HIGH'
    });

    await createNotification({
      role_target: 'PENGELOLA',
      title: 'Agenda Dibatalkan (Force Majeure)',
      message: `Persetujuan ${result.event_name} dicabut. Hentikan persiapan.`,
      action_url: `/pengelola/dashboard`,
      urgency: 'HIGH'
    });

    res.status(200).json({ message: 'Persetujuan berhasil dicabut (Force Majeure).', data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Terjadi kesalahan saat mencabut persetujuan.' });
  }
};

// GET My Bookings (For User Dashboard)
export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user_id = (req as any).user.id;
    const bookings = await prisma.bookings.findMany({
      where: { user_id },
      include: {
        schedules: { select: { usage_type: true, start_time: true, end_time: true } },
        vendors: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({ message: 'Berhasil.', data: bookings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const drawKopSurat = (doc: any) => {
  try {
    // Pastikan ada file logo-unhas.png di assets/images/
    doc.image('assets/images/logo-unhas.png', 50, 40, { width: 70 });
  } catch (e) {
    // Fallback jika tidak ada logo
  }

  // Teks Tengah (Kementerian & Universitas)
  doc.fontSize(10).font('Helvetica').fillColor('#000000').text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS,', 140, 45);
  doc.fontSize(10).font('Helvetica').text('DAN TEKNOLOGI', 140, 58);
  doc.fontSize(14).font('Helvetica-Bold').text('UNIVERSITAS HASANUDDIN', 140, 73);

  // Teks Kanan (Alamat & Kontak)
  const rightX = 350;
  const rightWidth = 200;
  doc.fontSize(9).font('Helvetica').text('Jalan Perintis Kemerdekaan Km. 10', rightX, 45, { width: rightWidth, align: 'right' });
  doc.text('Tamalanrea, Makassar 90245', rightX, 58, { width: rightWidth, align: 'right' });
  doc.text('e-mail: office@unhas.ac.id', rightX, 71, { width: rightWidth, align: 'right' });
  doc.text('Laman: www.unhas.ac.id', rightX, 84, { width: rightWidth, align: 'right' });
  
  // Set doc.y for content to start below header
  doc.y = 130;
};

// Generate PDF
export const getPdfBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    // ensure user owns it (or is kasubdit)
    const user = (req as any).user;
    
    const booking = await prisma.bookings.findUnique({ /* as any */
      where: { id: id as string },
      include: { user: true, schedules: true, vendors: true }}) as any;
    
    if (!booking) {
      res.status(404).json({ error: 'Data tidak ditemukan.' });
      return;
    }

    if (user.role !== 'kasubdit' && user.role !== 'pengelola' && booking.user_id !== user.id) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    if (booking.status !== 'approved') {
      res.status(400).json({ error: 'Surat izin hanya tersedia jika disetujui.' });
      return;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Surat_Izin_${booking.booking_code}.pdf"`);
    doc.pipe(res);

    // Tahap 1: Standardisasi Identitas Institusi (Kop Surat)
    drawKopSurat(doc);
    
    // Tahap 3: Restrukturisasi Tata Letak Isi Surat (Body Layout)
    doc.fontSize(14).font('Helvetica-Bold').text('SURAT IZIN PENGGUNAAN FASILITAS', 50, 160, { align: 'center', underline: true });
    doc.fontSize(11).font('Helvetica').text(`Nomor Registrasi: ${booking.booking_code}`, 50, doc.y, { align: 'center' });
    doc.moveDown(2.5);

    doc.fontSize(11).font('Helvetica').text('Berdasarkan evaluasi sistem Baruga Reserve dan persetujuan Pimpinan, dengan ini memberikan izin kepada:', 50, doc.y, { align: 'justify' });
    doc.moveDown(1);
    
    // Tahap 2: Sanitasi Data (Null Value Resolution)
    const instansi = booking.user.department_or_faculty ? booking.user.department_or_faculty : '-';
    
    // Tahap 2: Penyelarasan Tabel (Absolute X)
    const labelX = 70;
    const colonX = 200;
    const valueX = 215;
    let startY = doc.y;

    doc.text('Nama Pemohon', labelX, startY);
    doc.text(':', colonX, startY);
    doc.text(booking.user.name, valueX, startY);
    
    startY += 20;
    doc.text('Asal Instansi', labelX, startY);
    doc.text(':', colonX, startY);
    doc.text(instansi, valueX, startY);
    
    startY += 30;
    doc.text('Untuk menggunakan fasilitas Gedung Baruga A.P. Pettarani untuk kegiatan:', 50, startY);
    
    startY += 25;
    doc.text('Nama Acara', labelX, startY);
    doc.text(':', colonX, startY);
    doc.text(booking.event_name, valueX, startY);

    // Tahap 2: Granularitas Waktu
    const gladi = booking.schedules.find((s: any) => s.usage_type === 'gladi_timeslot');
    const mainSchedules = booking.schedules.filter((s: any) => s.usage_type === 'main_event_fullday' || s.usage_type === 'main_event_halfday');
    mainSchedules.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    startY += 20;
    const teksGladi = gladi 
      ? `${format(new Date(gladi.start_time), 'dd MMMM yyyy', { locale: localeId })} (${format(new Date(gladi.start_time), 'HH:mm')} - ${format(new Date(gladi.end_time), 'HH:mm')} WITA)`
      : "Tidak Ada / Persiapan di Hari H";
    doc.text('Jadwal Gladi', labelX, startY);
    doc.text(':', colonX, startY);
    doc.text(teksGladi, valueX, startY);
    
    if (mainSchedules.length > 0 || (booking as any).event_start_date) {
      startY += 20;
      const actualStart = (booking as any).actual_event_start || '08:00';
      const actualEnd = (booking as any).actual_event_end || '17:00';
      
      let startD = (booking as any).event_start_date ? new Date((booking as any).event_start_date) : new Date(mainSchedules[0]?.start_time);
      let endD = (booking as any).event_end_date ? new Date((booking as any).event_end_date) : new Date(mainSchedules[mainSchedules.length - 1]?.start_time || startD);

      const isSameDay = startD.toDateString() === endD.toDateString();
      let hariHStr = '';
      if (isSameDay) {
        hariHStr = `${format(startD, 'dd MMMM yyyy', { locale: localeId })} (Blokir Penuh) | Acara: ${actualStart} - ${actualEnd} WITA`;
      } else {
        hariHStr = `${format(startD, 'dd MMMM yyyy', { locale: localeId })} s/d ${format(endD, 'dd MMMM yyyy', { locale: localeId })} (${actualStart} - ${actualEnd} WITA)`;
      }

      doc.text('Jadwal Hari H', labelX, startY);
      doc.text(':', colonX, startY);
      doc.text(hariHStr, valueX, startY);
    }

    // Tahap 3: Injeksi Visibilitas Logistik
    const hasLogistik = booking.vendors && booking.vendors.length > 0;
    startY += 20;
    doc.text('Izin Logistik Eksternal', labelX, startY);
    doc.text(':', colonX, startY);
    if (hasLogistik) {
      doc.text('DIIZINKAN (Sesuai SOP Sekuensial Waktu Loading)', valueX, startY);
    } else {
      doc.text('TIDAK ADA / TIDAK DIIZINKAN', valueX, startY);
    }

    startY += 40;
    doc.text('Ketentuan: Seluruh tata tertib dan mitigasi risiko berlaku sesuai kesepakatan sistem Baruga Reserve.', 50, startY, { align: 'justify' });
    
    // Tahap 3: Tititimangsa
    startY += 40;
    const currentFormattedDate = format(new Date(), 'dd MMMM yyyy', { locale: localeId });
    doc.text(`Makassar, ${currentFormattedDate}`, 350, startY);

    // Tahap 4: Blok Otorisasi Digital
    startY += 20;
    doc.text('Kepala Subdirektorat Tata Usaha Rumah Tangga dan Keprotokolan,', 350, startY, { width: 200, align: 'left' });

    // QR Code Generation
    const trackUrl = `https://baruga.unhas.ac.id/verify/${booking.booking_code}`;
    const qrBuffer = await QRCode.toBuffer(trackUrl, { width: 80 });
    
    // Posisikan QR di bawah teks jabatan yang mungkin ter-wrap
    startY = doc.y + 5;
    doc.image(qrBuffer, 370, startY, { width: 80 });

    // Klausul Keabsahan Digital
    doc.fontSize(8).font('Helvetica-Oblique').text('Dokumen ini diterbitkan secara otomatis oleh sistem Baruga Reserve dan telah disetujui secara elektronik oleh Kepala Subdirektorat Tata Usaha Rumah Tangga dan Keprotokolan Universitas Hasanuddin.', 50, doc.page.height - 70, { align: 'center', width: doc.page.width - 100 });

    // TAHAP 1: Logika Kondisional & Inisiasi Halaman Baru
    if (hasLogistik || booking.external_logistics_status === 'rejected' || booking.external_logistics_status === 'pending') {
      doc.addPage();
      
      // TAHAP 2: Pembuatan Header Identitas Lampiran
      drawKopSurat(doc);
      
      doc.fontSize(12).font('Helvetica-Bold').text('LAMPIRAN I: MANIFESTO LOGISTIK & GATEPASS VENDOR', 50, doc.y, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Nomor Registrasi: ${booking.booking_code}`, 50, doc.y, { align: 'center' });
      doc.moveDown(3);

      if (booking.external_logistics_status === 'rejected') {
        doc.fontSize(14).fillColor('red').text('IZIN LOGISTIK EKSTERNAL: DITOLAK (Melewati Batas Waktu H-3)', 50, doc.y, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(2);
        doc.fontSize(10).text('Pemohon gagal melengkapi daftar manifes logistik hingga batas waktu H-3. Akses kendaraan vendor ditangguhkan.', 50, doc.y, { align: 'center' });
      } else if (booking.external_logistics_status === 'pending') {
        doc.fontSize(14).fillColor('orange').text('IZIN LOGISTIK EKSTERNAL: TERTUNDA (Menunggu Data Vendor)', 50, doc.y, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(2);
        doc.fontSize(10).text('Pemohon belum melengkapi daftar manifes logistik. Akses kendaraan vendor masih ditangguhkan.', 50, doc.y, { align: 'center' });
      } else {

      // TAHAP 3: Konstruksi Tabel Kertas Kerja
      const table = {
        headers: [
          { label: "Kategori", property: 'category', width: 80, renderer: null },
          { label: "Nama Vendor & PIC", property: 'vendor', width: 160, renderer: null },
          { label: "Jadwal Masuk & Keluar", property: 'schedule', width: 140, renderer: null },
          { label: "Paraf & Jam Tiba Aktual", property: 'paraf', width: 115, renderer: null }
        ],
        datas: booking.vendors.map((v: any) => ({
          category: v.vendor_category,
          vendor: `${v.vendor_name}\nPIC: ${v.pic_name}\n(${v.pic_phone})`,
          schedule: `Masuk: ${format(new Date(v.loading_start), 'dd/MM/yyyy HH:mm')}\nKeluar: ${format(new Date(v.unloading_end), 'dd/MM/yyyy HH:mm')}`,
          paraf: ''
        }))
      };

      await (doc as any).table(table, { 
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10), 
        prepareRow: () => doc.font('Helvetica').fontSize(9)
      });

      // TAHAP 4: Injeksi Klausul Keamanan
      doc.moveDown(2);
      const boxY = doc.y;
      doc.rect(50, boxY, 495, 60).stroke();
      doc.fontSize(9).font('Helvetica-Oblique').text(
        'Peringatan Keamanan: Satuan Pengamanan (Satpam) dan Pengelola Baruga A.P. Pettarani Universitas Hasanuddin memiliki kewenangan penuh untuk menolak akses masuk logistik apabila identitas PIC/Vendor tidak sesuai dengan manifesto ini, atau apabila armada vendor tiba sebelum Jendela Waktu Masuk (Loading) yang telah ditetapkan oleh sistem.',
        60, boxY + 10, { width: 475, align: 'justify' }
      );
      }
    }

    doc.end();
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// Track Booking (Public Endpoint)
export const trackBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingCode = req.params.bookingCode;
    const booking = await prisma.bookings.findUnique({ /* as any */
      where: { booking_code: bookingCode as string },
      select: {
        id: true,
        booking_code: true,
        event_name: true,
        status: true,
        admin_notes: true,
        created_at: true,
      }
    });

    if (!booking) {
      res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
      return;
    }

    res.status(200).json({ data: booking });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/bookings/:id/reschedule
export const rescheduleBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const {
      main_event_venue_id,
      main_event_start,
      main_event_end,
      rehearsal_venue_id,
      rehearsal_start,
      rehearsal_end,
      actual_event_start,
      actual_event_end,
      vendors
    } = req.body;

    const mainDateObj = new Date(main_event_start);
    const mainEventAbsoluteStart = new Date(mainDateObj.getFullYear(), mainDateObj.getMonth(), mainDateObj.getDate(), 0, 1, 0);
    const mainEventAbsoluteEnd = new Date(mainDateObj.getFullYear(), mainDateObj.getMonth(), mainDateObj.getDate(), 23, 59, 0);
    
    const gladiStartObj = new Date(rehearsal_start);
    const gladiEndObj = new Date(rehearsal_end);
    
    if (gladiStartObj >= mainEventAbsoluteStart) {
      res.status(400).json({ error: 'Tanggal Gladi Resik harus sebelum Hari H.' });
      return;
    }

    const gladiSetupBuffer = 30; 
    const gladiTeardownBuffer = 60; 
    
    let maxSetupBuffer = 0;
    let maxTeardownBuffer = 0;
    let vendorSchedules: any[] = [];

    let actualEventEndObj = new Date(mainEventAbsoluteEnd.getTime());
    if (actual_event_end) {
      const [h, m] = actual_event_end.split(':').map(Number);
      actualEventEndObj = new Date(mainDateObj.getFullYear(), mainDateObj.getMonth(), mainDateObj.getDate(), h, m, 0);
    }

    if (vendors && Array.isArray(vendors) && vendors.length > 0) {
      vendors.forEach(v => {
        let l_start: Date;
        let u_start: Date;
        let l_end = gladiStartObj; 
        let u_end: Date;
        
        if (['RIGGING', 'LED_VIDEOTRON', 'SOUND_SYSTEM', 'LIGHTING', 'SUPPORT_EQUIPMENT'].includes(v.category)) {
          l_start = new Date(gladiStartObj.getTime() - 6 * 60 * 60000);
          l_end = gladiStartObj;
          u_start = new Date(actualEventEndObj.getTime());
          u_end = new Date(actualEventEndObj.getTime() + 6 * 60 * 60000);
        } else {
          l_start = new Date(gladiStartObj.getTime() - 3 * 60 * 60000); 
          l_end = gladiStartObj;
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

        const setupDiff = (gladiStartObj.getTime() - l_start.getTime()) / 60000;
        if (setupDiff > maxSetupBuffer) maxSetupBuffer = setupDiff;

        const teardownDiff = (u_end.getTime() - actualEventEndObj.getTime()) / 60000;
        if (teardownDiff > maxTeardownBuffer) maxTeardownBuffer = teardownDiff;
      });
    }

    const finalGladiSetupBuffer = Math.max(gladiSetupBuffer, maxSetupBuffer);
    const mainEventAbsoluteEndWithBuffer = new Date(mainEventAbsoluteEnd.getTime() + maxTeardownBuffer * 60000);
    const gladiAbsoluteStart = new Date(gladiStartObj.getTime() - finalGladiSetupBuffer * 60000);

    const result = await prisma.$transaction(async (tx) => {
      // Check conflict
      const mainEventConflict = await tx.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Schedules 
        WHERE venue_id = ${main_event_venue_id} 
          AND status IN ('locked', 'confirmed', 'locked_temporary')
          AND booking_id != ${id}
          AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${mainEventAbsoluteEndWithBuffer})
          AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${mainEventAbsoluteStart})
      `;

      if (Number((mainEventConflict as any)[0].count) > 0) {
        throw new Error('Jadwal Hari H tidak tersedia atau berbenturan dengan waktu logistik acara lain.');
      }

      const rehearsalConflict = await tx.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Schedules 
        WHERE venue_id = ${rehearsal_venue_id} 
          AND status IN ('locked', 'confirmed', 'locked_temporary')
          AND booking_id != ${id}
          AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${gladiEndObj})
          AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${gladiAbsoluteStart})
      `;

      if (Number((rehearsalConflict as any)[0].count) > 0) {
        throw new Error('Jadwal Gladi Resik tidak tersedia atau berbenturan dengan waktu logistik acara lain.');
      }

      const booking = await tx.bookings.update({
        where: { id: id as string },
        data: {
          actual_event_start,
          actual_event_end,
          status: 'pending_reschedule',
        }
      });

      // Hapus vendor dan schedule lama
      await tx.bookingVendors.deleteMany({ where: { booking_id: id as string } });
      await tx.schedules.deleteMany({ where: { booking_id: id as string } });

      const schedulesData: any[] = [];
      let currentDate = new Date(mainEventAbsoluteStart.getTime());
      const end_date_adjusted = new Date(mainEventAbsoluteEnd.getTime());
      end_date_adjusted.setHours(0, 0, 0, 0);

      while (currentDate <= end_date_adjusted) {
        let currentLoopDate = new Date(currentDate.getTime());
        let dailyStart = new Date(currentLoopDate.setHours(0, 1, 0, 0));
        let dailyEnd = new Date(currentLoopDate.setHours(23, 59, 0, 0));

        schedulesData.push({
          booking_id: booking.id,
          venue_id: main_event_venue_id,
          usage_type: UsageType.main_event_fullday,
          start_time: dailyStart,
          end_time: dailyEnd,
          setup_buffer_minutes: 0,
          teardown_buffer_minutes: 0,
          status: 'locked_temporary',
          expires_at: null
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
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
          expires_at: null
        });
      }

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

    await createNotification({
      role_target: 'KASUBDIT',
      title: 'Perubahan Jadwal (Reschedule)',
      message: `Penyewa telah mengajukan perubahan jadwal untuk ${result.booking.event_name}.`,
      action_url: `/admin?highlight=${result.booking.booking_code}`,
      urgency: 'HIGH'
    });

    await createNotification({
      role_target: 'PENGELOLA',
      title: 'Perubahan Jadwal (Reschedule)',
      message: `Terdapat pengajuan perubahan jadwal untuk ${result.booking.event_name}.`,
      action_url: `/pengelola/dashboard`,
      urgency: 'LOW'
    });

    res.status(200).json({
      message: 'Jadwal pengganti berhasil dikunci.',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
