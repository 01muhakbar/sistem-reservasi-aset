const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const mainEventAbsoluteStart = new Date('2026-09-27T00:01:00.000Z');
  const mainEventAbsoluteEndWithBuffer = new Date('2026-09-27T23:59:00.000Z');
  const main_event_venue_id = 'c12345'; // dummy ID

  const mainEventConflict = await p.$queryRaw`
    SELECT COUNT(*) as count 
    FROM Schedules 
    WHERE venue_id = ${main_event_venue_id} 
      AND status IN ('locked', 'confirmed', 'locked_temporary')
      AND (DATE_SUB(start_time, INTERVAL setup_buffer_minutes MINUTE) < ${mainEventAbsoluteEndWithBuffer})
      AND (DATE_ADD(end_time, INTERVAL teardown_buffer_minutes MINUTE) > ${mainEventAbsoluteStart})
  `;
  console.log(mainEventConflict);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
