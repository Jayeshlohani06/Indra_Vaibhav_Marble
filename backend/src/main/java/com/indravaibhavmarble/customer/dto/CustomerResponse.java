
package com.indravaibhavmarble.customer.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CustomerResponse(
        Long id,
        String customerCode,
        String name,
        String phone,
        String email,
        String gstin,
        String billingAddress,
        String shippingAddress,
        BigDecimal creditLimit,
        boolean active,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
