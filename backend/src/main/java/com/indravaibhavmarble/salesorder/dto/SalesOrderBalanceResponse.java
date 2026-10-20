package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesOrderBalanceResponse(
        Long salesOrderId, String orderNumber, Long customerId,
        String customerName, BigDecimal orderTotal, BigDecimal totalPaid,
        BigDecimal outstandingBalance, String paymentStatus) {
}
