package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

/** How much of one bill line comes back. The second quantity is worked out when left out. */
public record SalesReturnItemRequest(
        Long salesOrderItemId,
        BigDecimal quantity,
        BigDecimal secondaryQuantity
) {
}
