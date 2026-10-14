
package com.indravaibhavmarble.salesorder.dto;

import java.time.LocalDate;
import java.util.List;

public record SalesOrderRequest(
        Long customerId,
        LocalDate orderDate,
        String taxType,
        String notes,
        List<SalesOrderItemRequest> items
) {
}
