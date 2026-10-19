
package com.indravaibhavmarble.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentDateSummaryResponse(
        LocalDate paymentDate,
        long paymentCount,
        BigDecimal totalAmount
) {}
