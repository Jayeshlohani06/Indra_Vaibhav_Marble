
package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesOrderItemRequest(
        Long productId,
        BigDecimal quantity,
        BigDecimal secondaryQuantity,
        String pricingUnit,
        BigDecimal unitPrice,
        BigDecimal gstRate
) {
}
