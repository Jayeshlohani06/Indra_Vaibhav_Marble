
package com.indravaibhavmarble.purchase.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record PurchaseResponse(
        Long id,
        String purchaseNumber,
        Long supplierId,
        String supplierName,
        String supplierInvoiceNumber,
        LocalDate purchaseDate,
        String status,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal gstAmount,
        String taxType,
        BigDecimal gstRate,
        BigDecimal cgstAmount,
        BigDecimal sgstAmount,
        BigDecimal igstAmount,
        BigDecimal expenseGstAmount,
        BigDecimal totalAmount,
        String notes,
        OffsetDateTime createdAt,
        List<PurchaseItemResponse> items,
        List<PurchaseExpenseResponse> expenses,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        String paymentStatus
) {
    public record PurchaseItemResponse(
            Long id,
            Long productId,
            String productCode,
            String productName,
            BigDecimal quantity,
            BigDecimal secondaryQuantity,
            String pricingUnit,
            BigDecimal purchaseRate,
            BigDecimal discountAmount,
            BigDecimal gstRate,
            BigDecimal gstAmount,
            BigDecimal lineTotal
    ) {
    }

    public record PurchaseExpenseResponse(
            Long id,
            Long categoryId,
            String description,
            BigDecimal amount
    ) {
    }
}
