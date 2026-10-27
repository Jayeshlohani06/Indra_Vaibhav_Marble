package com.indravaibhavmarble.cash.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public final class CashMovementDtos {

    private CashMovementDtos() {
    }

    public record MovementRequest(
            LocalDate movementDate,
            String movementType,
            BigDecimal amount,
            String referenceNumber,
            String notes,
            UUID requestId
    ) {
    }

    public record VoidRequest(String reason) {
    }

    public record MovementResponse(
            Long id,
            LocalDate movementDate,
            String movementType,
            BigDecimal amount,
            String referenceNumber,
            String notes,
            String status,
            String createdBy,
            OffsetDateTime createdAt,
            String approvedBy,
            String voidedBy,
            OffsetDateTime voidedAt,
            String voidReason
    ) {
    }
}
