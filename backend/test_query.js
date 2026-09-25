const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const mainEventAbsoluteStart = new Date('2026-09-25T16:01:00.000Z');
  const mainEventAbsoluteEndWithBuffer = new Date('2026-09-26T16:59:00.000Z');
  const main_event_venue_id = '2b26946d-2e41-4095-a3bd-10a7b4edbf80';
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
run().finally(() => process.exit(0));
