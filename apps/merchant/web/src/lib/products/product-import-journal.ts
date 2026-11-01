import { UuidSchema } from '@letbuyy/shared-types'
import type { WarehouseStorage, WarehouseLocks } from '../inventory/warehouse-command-journal'
export type ImportScope={actorId:string;siteId:string}
export type PendingProductImport=ImportScope&{version:2;key:string;sourceSha256:string}
const slot=(scope:ImportScope)=>`letbuyy.product-import.v2:${scope.actorId}:${scope.siteId}`
function checked(scope:ImportScope,value:unknown):PendingProductImport {
    if(!value||typeof value!=='object')throw new Error('The original import request needs recovery. Keep this browser data.')
    const v=value as PendingProductImport
    if(Object.keys(v).sort().join(',')!=='actorId,key,siteId,sourceSha256,version'||v.version!==2
        ||v.actorId!==scope.actorId||v.siteId!==scope.siteId||!UuidSchema.safeParse(v.actorId).success
        ||!UuidSchema.safeParse(v.siteId).success||!UuidSchema.safeParse(v.key).success
        ||typeof v.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceSha256))throw new Error('The original import identity could not be confirmed.')
    return Object.freeze({...v})
}
export function readProductImport(scope:ImportScope,storage:WarehouseStorage,locks:WarehouseLocks,check:()=>void) {
    return locks.request(slot(scope),()=>{check();const raw=storage.getItem(slot(scope));const value=raw===null?null:checked(scope,JSON.parse(raw));check();return value})
}
export function retainProductImport(scope:ImportScope,hash:string,storage:WarehouseStorage,locks:WarehouseLocks,check:()=>void) {
    return locks.request(slot(scope),()=>{
        check();const raw=storage.getItem(slot(scope)),old=raw===null?null:checked(scope,JSON.parse(raw))
        if(old){if(old.sourceSha256!==hash)throw new Error('Recover the original import before choosing different CSV contents.');return old}
        const value=checked(scope,{...scope,version:2,key:crypto.randomUUID(),sourceSha256:hash}),encoded=JSON.stringify(value)
        check();storage.setItem(slot(scope),encoded);if(storage.getItem(slot(scope))!==encoded)throw new Error('The import identity could not be retained. No new import was sent.')
        check();return value
    })
}
export function clearProductImport(value:PendingProductImport,storage:WarehouseStorage,locks:WarehouseLocks,check:()=>void) {
    return locks.request(slot(value),()=>{
        check();const raw=storage.getItem(slot(value));if(raw===null)return
        const current=checked(value,JSON.parse(raw));if(current.key!==value.key||current.sourceSha256!==value.sourceSha256)throw new Error('Original import storage changed.')
        storage.removeItem(slot(value));if(storage.getItem(slot(value))!==null)throw new Error('The confirmed import identity could not be retired.');check()
    })
}
