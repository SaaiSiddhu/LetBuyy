// Canonical Indian GST state codes (current, post Andhra/Telangana split and UT mergers).
// gst_state_code is the first two digits of a GSTIN and must match
// IndianStateCodeSchema (01–38 or 97) in @letbuyy/shared-types.

export interface GstState {
    code: string
    name: string
}

export const GST_STATES: GstState[] = [
    { code: '01', name: 'Jammu & Kashmir' },
    { code: '02', name: 'Himachal Pradesh' },
    { code: '03', name: 'Punjab' },
    { code: '04', name: 'Chandigarh' },
    { code: '05', name: 'Uttarakhand' },
    { code: '06', name: 'Haryana' },
    { code: '07', name: 'Delhi' },
    { code: '08', name: 'Rajasthan' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '10', name: 'Bihar' },
    { code: '11', name: 'Sikkim' },
    { code: '12', name: 'Arunachal Pradesh' },
    { code: '13', name: 'Nagaland' },
    { code: '14', name: 'Manipur' },
    { code: '15', name: 'Mizoram' },
    { code: '16', name: 'Tripura' },
    { code: '17', name: 'Meghalaya' },
    { code: '18', name: 'Assam' },
    { code: '19', name: 'West Bengal' },
    { code: '20', name: 'Jharkhand' },
    { code: '21', name: 'Odisha' },
    { code: '22', name: 'Chhattisgarh' },
    { code: '23', name: 'Madhya Pradesh' },
    { code: '24', name: 'Gujarat' },
    { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
    { code: '27', name: 'Maharashtra' },
    { code: '29', name: 'Karnataka' },
    { code: '30', name: 'Goa' },
    { code: '31', name: 'Lakshadweep' },
    { code: '32', name: 'Kerala' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '34', name: 'Puducherry' },
    { code: '35', name: 'Andaman & Nicobar Islands' },
    { code: '36', name: 'Telangana' },
    { code: '37', name: 'Andhra Pradesh' },
    { code: '38', name: 'Ladakh' },
    { code: '97', name: 'Other Territory' },
]

const NAME_BY_CODE = new Map(GST_STATES.map((s) => [s.code, s.name]))

export function gstStateName(code?: string | null): string {
    if (!code) return ''
    return NAME_BY_CODE.get(code.trim()) || ''
}

/** Derive the GST state code from the first two digits of a GSTIN. */
export function deriveGstStateCode(gstin?: string | null): string {
    if (!gstin) return ''
    const prefix = gstin.trim().slice(0, 2)
    return NAME_BY_CODE.has(prefix) ? prefix : ''
}

export function gstStateOptions(): Array<{ value: string; label: string }> {
    return [
        { value: '', label: 'Select state…' },
        ...GST_STATES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` })),
    ]
}
