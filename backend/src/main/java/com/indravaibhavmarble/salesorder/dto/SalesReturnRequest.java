package com.indravaibhavmarble.salesorder.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Takes goods back on a bill. refundMethod is needed only when the customer
 * has paid more than the bill is now worth.
 */
public record SalesReturnRequest(
        LocalDate returnDate,
        String reason,
        String refundMethod,
        List<SalesReturnItemRequest> items
) {
}
