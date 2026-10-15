package com.indravaibhavmarble.stockmovement.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.indravaibhavmarble.stockmovement.entity.StockMovement;

public record StockMovementResponse(
        Long id,
        Long productId,
        String movementType,
        BigDecimal quantityChange,
        BigDecimal stockBefore,
        BigDecimal stockAfter,
        String referenceType,
        Long referenceId,
        String referenceNumber,
        String notes,
        OffsetDateTime createdAt) {

    public static StockMovementResponse from(StockMovement movement) {
        return new StockMovementResponse(
                movement.getId(),
                movement.getProductId(),
                movement.getMovementType(),
                movement.getQuantityChange(),
                movement.getStockBefore(),
                movement.getStockAfter(),
                movement.getReferenceType(),
                movement.getReferenceId(),
                movement.getReferenceNumber(),
                movement.getNotes(),
                movement.getCreatedAt());
    }
}
