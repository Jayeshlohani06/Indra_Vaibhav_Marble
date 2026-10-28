// A payment method with no money in it for the period. Phones hide these rows
// so the list stays short; cash is always shown because it is the drawer.
export function isEmptyMethod(row) {
  return row.paymentMethod !== "CASH"
    && [row.saleReceipts, row.collections, row.refunds, row.supplierPayments, row.expenses, row.net]
      .every((value) => !Number(value));
}
