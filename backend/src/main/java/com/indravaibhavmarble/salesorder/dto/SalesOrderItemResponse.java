
package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesOrderItemResponse(
        Long id,
        Long productId,
        String productCode,
        String productName,
        String unitCode,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal gstRate,
        BigDecimal taxableAmount,
        BigDecimal cgstAmount,
        BigDecimal sgstAmount,
        BigDecimal igstAmount,
        BigDecimal lineTotal
) {
}
