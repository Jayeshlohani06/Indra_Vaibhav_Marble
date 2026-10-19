
package com.indravaibhavmarble.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        LocalDate expenseDate,
        String category,
        String description,
        BigDecimal amount,
        String paymentMethod,
        Long supplierId,
        String referenceNumber,
        String notes
) {
}
