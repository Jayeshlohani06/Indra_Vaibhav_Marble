package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record SalesReturnResponse(
        Long id,
        String returnNumber,
        LocalDate returnDate,
        String reason,
        boolean cancelsOrder,
        BigDecimal subtotal,
        BigDecimal totalTax,
        BigDecimal chargesAmount,
        BigDecimal totalAmount,
        BigDecimal refundAmount,
        String createdBy,
        OffsetDateTime createdAt,
        List<SalesReturnItemResponse> items
) {
}
