import { describe, expect, it } from "vitest";
import { isEmptyMethod } from "./cashMethods";

const zeroRow = {
  saleReceipts: 0,
  collections: 0,
  refunds: 0,
  supplierPayments: 0,
  expenses: 0,
  net: 0,
};

describe("isEmptyMethod", () => {
  it("treats a method with no money at all as empty", () => {
    expect(isEmptyMethod({ ...zeroRow, paymentMethod: "CARD" })).toBe(true);
  });

  it("never hides cash, even on a day with no cash", () => {
    expect(isEmptyMethod({ ...zeroRow, paymentMethod: "CASH" })).toBe(false);
  });

  it.each(["saleReceipts", "collections", "refunds", "supplierPayments", "expenses", "net"])(
    "keeps a method that has money in %s",
    (field) => {
      expect(isEmptyMethod({ ...zeroRow, paymentMethod: "UPI", [field]: 150 })).toBe(false);
    }
  );

  it("reads amounts sent as text, as the API does for decimals", () => {
    expect(isEmptyMethod({ ...zeroRow, paymentMethod: "UPI", net: "0.00" })).toBe(true);
    expect(isEmptyMethod({ ...zeroRow, paymentMethod: "UPI", net: "-200.00" })).toBe(false);
  });

  it("treats missing amounts as zero", () => {
    expect(isEmptyMethod({ paymentMethod: "CHEQUE" })).toBe(true);
  });
});
