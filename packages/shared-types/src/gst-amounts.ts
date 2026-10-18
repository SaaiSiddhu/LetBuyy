/** Shared integer amount decomposition; callers own tax policy and input validation. */
export function calculateGstAmounts(
  lineAmountMinor: number,
  rateBps: number,
  taxInclusive: boolean,
  supplyType: 'intra_state' | 'inter_state',
) {
  const taxable = taxInclusive ? Math.round(lineAmountMinor * 10_000 / (10_000 + rateBps)) : lineAmountMinor;
  const tax = taxInclusive ? lineAmountMinor - taxable : Math.round(taxable * rateBps / 10_000);
  const cgst = supplyType === 'intra_state' ? Math.floor(tax / 2) : 0;
  const sgst = supplyType === 'intra_state' ? tax - cgst : 0;
  return {
    taxable_amount_minor: taxable,
    tax_amount_minor: tax,
    total_amount_minor: taxable + tax,
    cgst_amount_minor: cgst,
    sgst_amount_minor: sgst,
    igst_amount_minor: supplyType === 'inter_state' ? tax : 0,
  };
}
