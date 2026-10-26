// The shop's GST state code (Bihar). The first two digits of a GSTIN are the
// state code, so a customer from another state is billed IGST.
export const BUSINESS_STATE_CODE = "10";

// Returns "INTRA" or "INTER" for a customer's GSTIN, or null when unknown.
export function taxTypeForGstin(gstin) {
  const prefix = String(gstin || "").trim().slice(0, 2);
  if (!/^\d{2}$/.test(prefix)) return null;
  return prefix === BUSINESS_STATE_CODE ? "INTRA" : "INTER";
}
