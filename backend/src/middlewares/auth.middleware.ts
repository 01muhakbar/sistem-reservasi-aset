import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'baruga_secret_key_123';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1] || (req.query.token as string);
    if (!token || token === 'null') {
      res.status(401).json({ error: 'Akses ditolak. Sesi tidak ditemukan.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded; // Attach user payload to request
    next();
  } catch (err) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Akses terlarang. Anda tidak memiliki izin untuk tindakan ini.' });
      return;
    }
    next();
  };
};
