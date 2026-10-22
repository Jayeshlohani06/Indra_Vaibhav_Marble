
package com.indravaibhavmarble.purchase.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PurchaseRequest(
        Long supplierId,
        String supplierInvoiceNumber,
        LocalDate purchaseDate,
        BigDecimal discountAmount,
        String taxType,
        BigDecimal gstRate,
        String notes,
        List<PurchaseItemRequest> items
) {
    public record PurchaseItemRequest(
            Long productId,
            BigDecimal quantity,
            BigDecimal purchaseRate,
            BigDecimal discountAmount,
            BigDecimal gstRate
    ) {
    }
}
