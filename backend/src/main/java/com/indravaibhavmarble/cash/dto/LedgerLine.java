package com.indravaibhavmarble.cash.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * One money entry as stored in its own table. {@code amount} is signed:
 * positive when money came in to the payment method, negative when it went out.
 *
 * @param source   SALES_PAYMENT, PURCHASE_PAYMENT, EXPENSE or CASH_MOVEMENT
 * @param kind     SALE_RECEIPT (paid on the bill's own date), COLLECTION
 *                 (paid on an older bill), REFUND, SUPPLIER_PAYMENT, EXPENSE,
 *                 or a cash movement type
 */
public record LedgerLine(
        String source,
        Long sourceId,
        LocalDate date,
        String kind,
        String paymentMethod,
        BigDecimal amount,
        String reference,
        String party,
        String detail,
        String createdBy,
        OffsetDateTime createdAt
) {
}
