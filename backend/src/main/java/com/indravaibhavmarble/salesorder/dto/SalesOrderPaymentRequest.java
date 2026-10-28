package com.indravaibhavmarble.salesorder.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SalesOrderPaymentRequest(
        @NotNull LocalDate paymentDate,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2)
        BigDecimal amount,
        @NotBlank @Size(max = 30) String paymentMethod,
        @Size(max = 100) String referenceNumber,
        @Size(max = 1000) String notes,
        UUID requestId) {

    public SalesOrderPaymentRequest(LocalDate paymentDate, BigDecimal amount, String paymentMethod,
            String referenceNumber, String notes) {
        this(paymentDate, amount, paymentMethod, referenceNumber, notes, null);
    }
}
