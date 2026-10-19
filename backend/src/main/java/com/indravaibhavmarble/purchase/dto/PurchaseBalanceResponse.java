
package com.indravaibhavmarble.purchase.dto;

import java.math.BigDecimal;

public record PurchaseBalanceResponse(
        Long purchaseId,
        String purchaseNumber,
        Long supplierId,
        String supplierName,
        BigDecimal purchaseTotal,
        BigDecimal totalPaid,
        BigDecimal outstandingBalance
) {
}
