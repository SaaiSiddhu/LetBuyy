/** Private PostgREST projection only; the shared schema validates the result. */
function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function projectInventoryReservationRead(value: unknown): unknown {
    if (!record(value)) return value;
    const line = value.transfer_line;
    let transfer: unknown = null;
    if (line !== null && line !== undefined) {
        if (!record(line) || !record(line.transfer) || !record(line.metadata)) return {};
        const parent = line.transfer;
        const provenance = line.metadata.canonical_reservation436;
        const base = provenance === undefined ? 0 : record(provenance) ? provenance.base_received : undefined;
        transfer = {
            id: parent.id === line.transfer_id ? parent.id : undefined,
            reservation_id: line.reservation_id,
            line_id: line.id,
            site_id: parent.site_id === line.site_id ? parent.site_id : undefined,
            source_location_id: parent.source_location_id,
            product_id: line.product_id,
            variant_id: line.variant_id,
            transfer_number: parent.transfer_number,
            status: parent.status,
            quantity_requested: line.quantity_requested,
            quantity_received: line.quantity_received,
            base_received: base,
        };
    }
    return { ...value, expires_at: value.expires_at === 'infinity' ? null : value.expires_at, transfer };
}
