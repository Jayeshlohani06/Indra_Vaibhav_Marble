package com.indravaibhavmarble.cash.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Money for a period, worked out from stored entries only.
 *
 * <p>{@code cash} is the drawer. {@code byMethod} shows every payment method
 * so UPI, bank and card can be checked against statements; they never change
 * expected cash. The "not cash" figures (bills raised, credit, purchases)
 * explain the day but are not money in or out.
 */
public record CashSummary(
        LocalDate periodStart,
        LocalDate periodEnd,
        BigDecimal openingBalance,
        CashFlows cash,
        BigDecimal expectedCash,
        List<MethodTotals> byMethod,
        BigDecimal billsRaised,
        BigDecimal billsStillUnpaid,
        BigDecimal purchasesReceived,
        BigDecimal purchasesStillUnpaid
) {

    /** Cash drawer flows; every figure is a positive amount. */
    public record CashFlows(
            BigDecimal saleReceipts,
            BigDecimal collections,
            BigDecimal ownerCashIn,
            BigDecimal bankWithdrawals,
            BigDecimal adjustmentsIn,
            BigDecimal refunds,
            BigDecimal supplierPayments,
            BigDecimal expenses,
            BigDecimal ownerCashOut,
            BigDecimal bankDeposits,
            BigDecimal adjustmentsOut,
            BigDecimal totalIn,
            BigDecimal totalOut
    ) {
    }

    public record MethodTotals(
            String paymentMethod,
            BigDecimal saleReceipts,
            BigDecimal collections,
            BigDecimal refunds,
            BigDecimal supplierPayments,
            BigDecimal expenses,
            BigDecimal net
    ) {
    }
}
