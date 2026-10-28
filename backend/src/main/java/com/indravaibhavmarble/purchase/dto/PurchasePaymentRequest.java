
package com.indravaibhavmarble.purchase.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PurchasePaymentRequest(

        @NotNull(message = "Payment date is required.")
        LocalDate paymentDate,

        @NotNull(message = "Payment amount is required.")
        @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero.")
        @Digits(integer = 12, fraction = 2,
                message = "Payment amount must have at most 12 integer digits and 2 decimal places.")
        BigDecimal amount,

        @NotBlank(message = "Payment method is required.")
        @Size(max = 30, message = "Payment method cannot exceed 30 characters.")
        String paymentMethod,

        @Size(max = 100, message = "Reference number cannot exceed 100 characters.")
        String referenceNumber,

        @Size(max = 1000, message = "Notes cannot exceed 1000 characters.")
        String notes,

        /** Set once per form so a double-tapped save records the payment once. */
        UUID requestId
) {

    public PurchasePaymentRequest(LocalDate paymentDate, BigDecimal amount, String paymentMethod,
            String referenceNumber, String notes) {
        this(paymentDate, amount, paymentMethod, referenceNumber, notes, null);
    }
}
