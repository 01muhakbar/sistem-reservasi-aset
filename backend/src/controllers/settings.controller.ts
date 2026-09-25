import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Get setting by key
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;
    const setting = await prisma.settings.findUnique({
      where: { key }
    });

    if (!setting) {
      // Return a default value if not found (especially for SOP)
      if (key === 'sop_text') {
        const defaultSOP = `**1. Ketentuan Umum**
Penggunaan Gedung Baruga A.P. Pettarani harus sesuai dengan izin yang diberikan dan tidak diperkenankan untuk kegiatan yang melanggar hukum atau norma kesusilaan.

**2. Kapasitas & Kebersihan**
Kapasitas maksimal gedung adalah 2.500 orang. Panitia wajib menjaga kebersihan dan menanggung biaya pembersihan jika gedung kotor pasca acara.

**3. Kerusakan Aset**
Segala kerusakan fasilitas yang terjadi selama masa peminjaman menjadi tanggung jawab penuh panitia dan akan dibebankan ganti rugi sesuai nilai aset.

**4. Pembatalan & Force Majeure**
Pihak rektorat berhak mencabut izin penggunaan sewaktu-waktu tanpa kompensasi finansial apabila terdapat agenda VVIP mendadak berskala nasional atau internasional.`;
        
        // Auto seed the default SOP if it doesn't exist
        await prisma.settings.create({
          data: { key: 'sop_text', value: defaultSOP }
        });
        
        res.status(200).json({ data: { key: 'sop_text', value: defaultSOP } });
        return;
      }

      res.status(404).json({ error: 'Setting tidak ditemukan.' });
      return;
    }

    res.status(200).json({ data: setting });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Terjadi kesalahan saat mengambil setting.' });
  }
};

// Update setting by key
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({ error: 'Value diperlukan.' });
      return;
    }

    const updatedSetting = await prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    res.status(200).json({ message: 'Setting berhasil diperbarui.', data: updatedSetting });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Terjadi kesalahan saat memperbarui setting.' });
  }
};
