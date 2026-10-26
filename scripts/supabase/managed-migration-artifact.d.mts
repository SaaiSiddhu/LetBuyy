export const MANAGED_MIGRATION_PROFILE: 'trusted-admin-maintenance-v1';
export interface ManagedMigrationReceipt {
    profile: typeof MANAGED_MIGRATION_PROFILE;
    name: string;
    sourceSha256: string;
    executedSha256: string;
    admissionSha256: string;
    adaptedFences: number;
    adaptedRoleChecks: Array<{sourceSha256:string;executedSha256:string}>;
    nativeCatalogExclusion: false;
    applicationTableLocks: boolean;
}
export function compileManagedMigration(source:string,name:string):Readonly<{sql:string;receipt:Readonly<ManagedMigrationReceipt>}>;
export function compileManagedMigrationBatch(entries:Array<{source:string;name:string}>,windowId:string):Readonly<{
    sql:string;
    manifest:Readonly<{profile:typeof MANAGED_MIGRATION_PROFILE;windowId:string;batchSha256:string;admissionSha256:string;
        migrations:Readonly<ManagedMigrationReceipt>[];requiresSingleBackend:true;privilegedAdministratorDdlExcludedOperationally:true}>;
}>;
export const MANAGED_HISTORY_DIGEST_SQL: string;
export function compileManagedJournalBatch(entries:Array<{source:string;name:string}>,windowId:string,options:{
    expectedHistorySha256:string;direction?:'up'|'down';forwardEntries?:Array<{source:string;name:string}>;
}):Readonly<{sql:string;manifest:Readonly<Record<string,unknown>>}>;
