import { Request, Response } from 'express';
import { PrismaClient, RoleTarget } from '@prisma/client';
import { addSSEClient } from '../services/notification.service';

const prisma = new PrismaClient();

// GET /api/notifications/stream
export const streamNotifications = (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Depending on authentication logic, you extract the user info.
  // Assuming req.user is populated via requireAuth middleware.
  const user = (req as any).user;
  if (!user) {
    res.end();
    return;
  }

  // Register the client under both user ID and RoleTarget
  addSSEClient(user.id, res);

  // Map application roles to RoleTarget enum
  let roleTarget: string | null = null;
  if (user.role === 'kasubdit') roleTarget = 'KASUBDIT';
  else if (user.role === 'pengelola') roleTarget = 'PENGELOLA';
  else if (['mahasiswa', 'fakultas', 'umum_komersial'].includes(user.role)) roleTarget = 'PENGGUNA';

  if (roleTarget) {
    addSSEClient(roleTarget, res);
  }

  // Initial dummy event to establish connection
  res.write('data: {"connected": true}\n\n');
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let roleTarget: RoleTarget | null = null;
    if (user.role === 'kasubdit') roleTarget = 'KASUBDIT';
    else if (user.role === 'pengelola') roleTarget = 'PENGELOLA';
    else if (['mahasiswa', 'fakultas', 'umum_komersial'].includes(user.role)) roleTarget = 'PENGGUNA';

    const conditions: any[] = [];
    if (roleTarget) {
      conditions.push({ role_target: roleTarget });
    }
    conditions.push({ user_id: user.id });

    const count = await prisma.notifications.count({
      where: {
        is_read: false,
        OR: conditions.length > 0 ? conditions : undefined
      }
    });

    res.status(200).json({ data: { count } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let roleTarget: RoleTarget | null = null;
    if (user.role === 'kasubdit') roleTarget = 'KASUBDIT';
    else if (user.role === 'pengelola') roleTarget = 'PENGELOLA';
    else if (['mahasiswa', 'fakultas', 'umum_komersial'].includes(user.role)) roleTarget = 'PENGGUNA';

    const conditions: any[] = [];
    if (roleTarget) {
      conditions.push({ role_target: roleTarget });
    }
    conditions.push({ user_id: user.id });

    const notifications = await prisma.notifications.findMany({
      where: {
        OR: conditions.length > 0 ? conditions : undefined
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    res.status(200).json({ data: notifications });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await prisma.notifications.update({
      where: { id: id as string },
      data: { is_read: true }
    });
    res.status(200).json({ data: notification });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /api/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    await prisma.notifications.updateMany({
      where: { 
        is_read: false,
        OR: [
          { user_id: user.id },
          { role_target: user.role === 'kasubdit' ? 'KASUBDIT' : (user.role === 'pengelola' ? 'PENGELOLA' : 'PENGGUNA') }
        ]
      },
      data: { is_read: true }
    });
    res.status(200).json({ message: 'Semua notifikasi ditandai dibaca.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notifications.delete({
      where: { id: id as string }
    });
    res.status(200).json({ message: 'Notifikasi berhasil dihapus.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
