
package com.indravaibhavmarble.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FinancialSummaryResponse(
        LocalDate startDate,
        LocalDate endDate,
        long salesOrderCount,
        BigDecimal salesOrderTotal,
        long receivedPurchaseCount,
        BigDecimal receivedPurchaseTotal,
        long expenseCount,
        BigDecimal expenseTotal
) {
}
