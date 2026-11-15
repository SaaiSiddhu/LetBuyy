import type {WarehousePurchaseOrderLine,WarehouseTransferLine,WarehousePurchaseOrder,WarehouseTransfer} from '@letbuyy/shared-types'

/** Current scoped read projections, separate from immutable command receipts. */
export function warehouseLineLabel(line:WarehousePurchaseOrderLine|WarehouseTransferLine):string {
    const product=line.product
    const name=product?.name || `Product unavailable (${line.product_id.slice(0,8)})`
    const variant=line.variant?.title || (line.variant_id ? `Variant unavailable (${line.variant_id.slice(0,8)})` : '')
    const sku=line.variant?.sku || product?.sku
    return [name+(product?.deleted_at?' (deleted)':''),variant,sku].filter(Boolean).join(' / ')
}

export function warehouseLocationLabel(reference:WarehousePurchaseOrder['location']|WarehouseTransfer['source_location'],id:string|null):string {
    if(!reference?.name)return id ? `Location unavailable (${id.slice(0,8)})` : 'No location'
    return reference.name+(reference.deleted_at?' (deleted)':'')
}
