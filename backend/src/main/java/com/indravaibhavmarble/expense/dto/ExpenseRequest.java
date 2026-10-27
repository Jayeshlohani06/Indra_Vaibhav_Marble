package com.indravaibhavmarble.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * @param salaryPeriod any day in the month a salary or advance is for
 * @param requestId    set once per form so a double-submitted save records
 *                     the expense only once
 */
public record ExpenseRequest(
        LocalDate expenseDate,
        String category,
        String description,
        BigDecimal amount,
        String paymentMethod,
        Long supplierId,
        String referenceNumber,
        String notes,
        String payee,
        Long staffMemberId,
        LocalDate salaryPeriod,
        UUID requestId
) {
}
