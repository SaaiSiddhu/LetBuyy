export interface OwnedNextDirectoryBinding {
    readonly root:string;
    readonly kind:string;
    readonly runId:string;
    readonly supervisorPid:number;
    readonly parentPid:number;
}
export interface OwnedNextDirectoryReceipt extends OwnedNextDirectoryBinding {
    readonly version:1;
    readonly token:string;
}
export function claimOwnedNextDirectory(binding:OwnedNextDirectoryBinding):OwnedNextDirectoryReceipt;
export function ownedNextDirectoryName(receipt:OwnedNextDirectoryReceipt):string;
export function validateOwnedNextDirectoryReceipt(receipt:unknown, expected:OwnedNextDirectoryBinding):OwnedNextDirectoryReceipt;
export function removeOwnedNextDirectory(receipt:OwnedNextDirectoryReceipt):boolean;
