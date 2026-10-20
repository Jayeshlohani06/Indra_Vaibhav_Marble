package com.indravaibhavmarble.salesorder.dto;

import java.math.BigDecimal;

public record SalesOrderChargeResponse(Long id, String description, BigDecimal amount) {
}
