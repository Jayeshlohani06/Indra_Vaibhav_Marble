
package com.indravaibhavmarble.report.dto;

import java.math.BigDecimal;

public record SupplierOutstandingResponse(
        Long supplierId,
        String supplierName,
        long receivedPurchaseCount,
        BigDecimal purchaseTotal,
        BigDecimal totalPaid,
        BigDecimal outstandingBalance
) {
}
