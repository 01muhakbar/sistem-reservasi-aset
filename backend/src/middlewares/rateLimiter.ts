import rateLimit from 'express-rate-limit';

export const publicAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // Batas 5 permintaan
  message: { error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.' },
  standardHeaders: true, // Mengembalikan info batas di header `RateLimit-*`
  legacyHeaders: false, // Nonaktifkan header `X-RateLimit-*`
});
