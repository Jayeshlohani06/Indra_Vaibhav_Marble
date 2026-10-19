
package com.indravaibhavmarble.purchase.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PurchasePaymentResponse(
        Long id,
        Long purchaseId,
        LocalDate paymentDate,
        BigDecimal amount,
        String paymentMethod,
        String referenceNumber,
        String notes,
        OffsetDateTime createdAt
) {
}
