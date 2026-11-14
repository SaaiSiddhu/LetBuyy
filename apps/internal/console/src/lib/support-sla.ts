import type { ConsoleSupportClock } from '@letbuyy/shared-types';
/** Presentation of canonical recorded clocks; this does not create or pause a clock. */
export function supportSlaPresentation(clock: ConsoleSupportClock, observedAt: string) {
    const due=Date.parse(clock.due_at), observed=Date.parse(observedAt), satisfied=clock.satisfied_at?Date.parse(clock.satisfied_at):null;
    if(!Number.isFinite(due)||!Number.isFinite(observed))return {label:'Unknown',tone:'neutral' as const};
    const late=clock.breached || (satisfied!==null? satisfied>due: observed>due);
    if(satisfied!==null)return {label:late?'Completed late':'Completed',tone:late?'warning' as const:'success' as const};
    if(clock.paused)return {label:clock.breached?'Paused · breached':'Paused',tone:'warning' as const};
    return {label:late?'Overdue':'Running',tone:late?'critical' as const:'neutral' as const};
}
