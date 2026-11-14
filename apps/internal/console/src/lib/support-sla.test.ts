import assert from 'node:assert/strict';
import test from 'node:test';
import { supportSlaPresentation } from './support-sla';
const clock={id:'clock',ticket_id:'ticket',clock_type:'resolution' as const,due_at:'2026-10-22T12:00:00Z',paused:false,breached:false,satisfied_at:null as string|null};
test('active recorded deadlines become overdue; missing time remains unknown',()=>{
 assert.equal(supportSlaPresentation(clock,'2026-10-22T11:00:00Z').label,'Running');
 assert.equal(supportSlaPresentation(clock,'2026-10-22T13:00:00Z').label,'Overdue');
 assert.equal(supportSlaPresentation(clock,'invalid').label,'Unknown');
});
test('paused and completed clocks retain their distinct breach evidence',()=>{
 assert.equal(supportSlaPresentation({...clock,paused:true},'2026-10-22T13:00:00Z').label,'Paused');
 assert.equal(supportSlaPresentation({...clock,paused:true,breached:true},'2026-10-22T13:00:00Z').label,'Paused · breached');
 assert.equal(supportSlaPresentation({...clock,satisfied_at:'2026-10-22T11:00:00Z'},'2026-10-22T13:00:00Z').label,'Completed');
 assert.equal(supportSlaPresentation({...clock,satisfied_at:'2026-10-22T12:01:00Z'},'2026-10-22T13:00:00Z').label,'Completed late');
});
