import { PrismaClient, KycStatus, Role } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'baruga_secret_key_123';
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || 'baruga_reset_secret_321';

// Set JWT Cookie Helper
const sendTokenResponse = (user: any, statusCode: number, res: Response, message: string) => {
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });

  res.status(statusCode).json({
    message,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      kyc_status: user.kyc_status
    }
  });
};

// 1. Login Publik (Lokal/Bcrypt)
export const loginPublic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password harus diisi.' });
      return;
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Kredensial tidak valid.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Kredensial tidak valid.' });
      return;
    }

    // Walaupun KYC Pending, mereka tetap boleh login ke Dashboard,
    // tapi tidak boleh booking (dicek di middleware booking).
    
    sendTokenResponse(user, 200, res, 'Login sukses.');
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Login Internal (SSO Mock)
export const loginSSO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body; // Mock identifier from Neosia/Sikola
    
    // Simulate lookup in internal DB, or auto-provision
    let user = await prisma.users.findUnique({ where: { email } });
    
    if (!user) {
      // Auto-provision mock based on email domain
      let role = Role.mahasiswa as any;
      if (email.includes('admin') || email.includes('kasubdit' as any)) role = Role.kasubdit;
      else if (email.includes('dosen')) role = Role.fakultas;
      else if (email.includes('pengelola' as any)) role = Role.pengelola;

      user = await prisma.users.create({
        data: {
          name: email.split('@')[0],
          email,
          role,
          kyc_status: KycStatus.NONE, // Internal tak perlu KYC
        }
      });
    }

    sendTokenResponse(user, 200, res, 'SSO Login sukses.');
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Register Publik (KYC)
export const registerPublic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, identity_doc_url } = req.body;

    if (!name || !email || !password || !identity_doc_url) {
      res.status(400).json({ error: 'Seluruh field (termasuk dokumen NIB/KTP) wajib diisi.' });
      return;
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email sudah terdaftar.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await prisma.users.create({
      data: {
        name,
        email,
        password_hash,
        role: Role.umum_komersial,
        kyc_status: KycStatus.PENDING,
        identity_doc_url,
      }
    });

    sendTokenResponse(newUser, 201, res, 'Registrasi berhasil. Menunggu verifikasi Kasubdit.');
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Lupa Kata Sandi
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });

    if (!user || user.role !== Role.umum_komersial) {
      // Always return success to prevent email enumeration
      res.status(200).json({ message: 'Jika email terdaftar, instruksi pemulihan telah dikirim.' });
      return;
    }

    // Generate Short-lived Token (15 mins)
    const resetToken = jwt.sign({ id: user.id }, JWT_RESET_SECRET, { expiresIn: '15m' });
    
    await prisma.users.update({
      where: { id: user.id },
      data: {
        reset_password_token: resetToken,
        reset_password_expires: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    // Mock Email Dispatch
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`\n======================================================`);
    console.log(`[MOCK EMAIL SMTP] Password Recovery for ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log(`======================================================\n`);

    res.status(200).json({ message: 'Jika email terdaftar, instruksi pemulihan telah dikirim.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Reset Kata Sandi
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      res.status(400).json({ error: 'Token dan kata sandi baru diperlukan.' });
      return;
    }

    // Verify Token
    const decoded = jwt.verify(token, JWT_RESET_SECRET) as { id: string };
    
    const user = await prisma.users.findFirst({
      where: {
        id: decoded.id,
        reset_password_token: token,
        reset_password_expires: { gt: new Date() } // Must not be expired
      }
    });

    if (!user) {
      res.status(400).json({ error: 'Sesi pemulihan tidak valid atau telah kedaluwarsa.' });
      return;
    }

    // Hash New Password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_password_token: null,
        reset_password_expires: null
      }
    });

    res.status(200).json({ message: 'Kata sandi berhasil diatur ulang. Silakan login kembali.' });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(400).json({ error: 'Token pemulihan kedaluwarsa.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

// 6. Get Current User (Me) - Untuk Frontend Load Sesi
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User tidak ditemukan.' });
      return;
    }
    res.status(200).json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        kyc_status: user.kyc_status
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Logout
export const logout = (req: Request, res: Response): void => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logout berhasil.' });
};
