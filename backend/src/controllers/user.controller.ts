import { PrismaClient, KycStatus } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Get Users with PENDING KYC
export const getPendingKycUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.users.findMany({
      where: { kyc_status: KycStatus.PENDING },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        kyc_status: true,
        identity_doc_url: true
      }
    });
    res.status(200).json({ data: users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Verify User KYC
export const verifyKyc = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // VERIFIED or REJECTED

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Status KYC tidak valid.' });
      return;
    }

    const user = await prisma.users.update({
      where: { id: id as string },
      data: { kyc_status: status as KycStatus }
    });

    res.status(200).json({ message: `Status KYC akun berhasil diperbarui menjadi ${status}.`, data: { id: user.id, kyc_status: user.kyc_status } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
