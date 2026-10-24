
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
        List<PurchaseItemRequest> items,
        List<PurchaseExpenseRequest> expenses
) {
    public record PurchaseItemRequest(
            Long productId,
            BigDecimal quantity,
            BigDecimal secondaryQuantity,
            String pricingUnit,
            BigDecimal purchaseRate,
            BigDecimal discountAmount,
            BigDecimal gstRate
    ) {
    }

    public record PurchaseExpenseRequest(
            Long categoryId,
            String description,
            BigDecimal amount
    ) {
    }
}
