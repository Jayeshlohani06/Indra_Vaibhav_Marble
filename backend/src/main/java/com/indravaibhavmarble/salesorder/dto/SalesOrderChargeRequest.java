package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesOrderChargeRequest(String description, BigDecimal amount) {
}
