package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record SalesOrderPaymentResponse(
        Long id, Long salesOrderId, LocalDate paymentDate, BigDecimal amount,
        String paymentMethod, String referenceNumber, String notes,
        OffsetDateTime createdAt) {
}
