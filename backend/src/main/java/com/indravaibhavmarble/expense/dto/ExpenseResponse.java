
package com.indravaibhavmarble.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ExpenseResponse(
        Long id,
        LocalDate expenseDate,
        String category,
        String description,
        BigDecimal amount,
        String paymentMethod,
        Long supplierId,
        String referenceNumber,
        String notes,
        String status,
        OffsetDateTime voidedAt,
        String voidReason,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
