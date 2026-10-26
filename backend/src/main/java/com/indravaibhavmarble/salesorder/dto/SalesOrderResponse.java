
package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record SalesOrderResponse(
        Long id,
        String orderNumber,
        Long customerId,
        String customerName,
        LocalDate orderDate,
        String status,
        String taxType,
        BigDecimal subtotal,
        BigDecimal cgstAmount,
        BigDecimal sgstAmount,
        BigDecimal igstAmount,
        BigDecimal totalTax,
        BigDecimal grandTotal,
        String notes,
        OffsetDateTime createdAt,
        List<SalesOrderItemResponse> items,
        List<SalesOrderChargeResponse> charges,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        String paymentStatus
) {
}
