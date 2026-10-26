package com.indravaibhavmarble.report.dto;

import java.math.BigDecimal;

public record CustomerOutstandingResponse(
        Long customerId,
        String customerName,
        String phone,
        long orderCount,
        BigDecimal orderTotal,
        BigDecimal totalPaid,
        BigDecimal outstandingBalance
) {
}
