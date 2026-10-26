package com.indravaibhavmarble.common.payment;

import java.math.BigDecimal;

/**
 * Payment state of a bill from its total and the amount paid so far.
 */
public final class PaymentStatus {

    public static final String UNPAID = "UNPAID";
    public static final String PARTIALLY_PAID = "PARTIALLY_PAID";
    public static final String PAID = "PAID";

    private PaymentStatus() {
    }

    public static String of(BigDecimal total, BigDecimal paid) {
        BigDecimal safeTotal = total == null ? BigDecimal.ZERO : total;
        BigDecimal safePaid = paid == null ? BigDecimal.ZERO : paid;

        if (safePaid.compareTo(safeTotal) >= 0) {
            return PAID;
        }
        return safePaid.signum() == 0 ? UNPAID : PARTIALLY_PAID;
    }
}
