package com.indravaibhavmarble.salesorder.dto;

import java.time.LocalDate;

public record SalesOrderCancelRequest(
        LocalDate cancelDate,
        String reason,
        String refundMethod
) {
}
