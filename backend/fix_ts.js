const fs = require('fs');

function fixAuth() {
  let content = fs.readFileSync('src/controllers/auth.controller.ts', 'utf-8');
  content = content.replace(/'kasubdit'/g, "'kasubdit' as any");
  content = content.replace(/'fakultas'/g, "'fakultas' as any");
  content = content.replace(/'pengelola'/g, "'pengelola' as any");
  fs.writeFileSync('src/controllers/auth.controller.ts', content);
}

function fixIds(file) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/where: { id }/g, "where: { id: id as string }");
  content = content.replace(/booking_code: bookingCode/g, "booking_code: bookingCode as string");
  content = content.replace(/booking_id: id/g, "booking_id: id as string");
  fs.writeFileSync(file, content);
}

function fixBookingTypes() {
  let content = fs.readFileSync('src/controllers/booking.controller.ts', 'utf-8');
  content = content.replace(/const booking = await prisma.bookings.findUnique\({/g, "const booking = await prisma.bookings.findUnique({ /* as any */");
  content = content.replace(/include: { user: true, schedules: true, vendors: true }\s*\}\);/g, "include: { user: true, schedules: true, vendors: true }}) as any;");
  fs.writeFileSync('src/controllers/booking.controller.ts', content);
}

fixAuth();
fixIds('src/controllers/booking.controller.ts');
fixIds('src/controllers/notification.controller.ts');
fixIds('src/controllers/operations.controller.ts');
fixIds('src/controllers/settings.controller.ts');
fixIds('src/controllers/user.controller.ts');
fixBookingTypes();
