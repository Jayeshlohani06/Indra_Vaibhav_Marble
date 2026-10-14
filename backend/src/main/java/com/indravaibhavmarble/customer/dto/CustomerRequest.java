
package com.indravaibhavmarble.customer.dto;

import java.math.BigDecimal;

public record CustomerRequest(
        String customerCode,
        String name,
        String phone,
        String email,
        String gstin,
        String billingAddress,
        String shippingAddress,
        BigDecimal creditLimit
) {
}
