// Unit fixture only. Native SQLite/Worker behavior is proved in the owned lane.
import { evaluateLeakyBucket } from '../../middleware/rateLimit';
export function createTestAdmissionCoordinator(): DurableObjectNamespace {
    const counts = new Map<string,number>();
    const entries = new Map<string, {used:number;updatedAt:number}>();
    return {
        idFromName: (name:string) => name,
        get: (name:string) => ({fetch: async (_url:unknown, init:RequestInit) => {
            const input=JSON.parse(String(init.body));
            if(String(_url).endsWith('/fixed-window')){const count=(counts.get(name)||0)+1;counts.set(name,count);return Response.json({allowed:count<=input.max,remaining:Math.max(0,input.max-count),resetAt:Date.now()+input.windowMs,unavailable:false});}
            const result=evaluateLeakyBucket({...input,now:Date.now(),entry:entries.get(name) ?? null});
            entries.set(name,result.entry);
            return Response.json(result);
        }}),
    } as unknown as DurableObjectNamespace;
}
