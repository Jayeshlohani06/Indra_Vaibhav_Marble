package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesReturnItemResponse(
        Long salesOrderItemId,
        String productName,
        String unitCode,
        BigDecimal quantity,
        BigDecimal secondaryQuantity,
        BigDecimal lineTotal
) {
}
