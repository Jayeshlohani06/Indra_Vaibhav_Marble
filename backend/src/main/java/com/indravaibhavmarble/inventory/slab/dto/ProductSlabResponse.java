
package com.indravaibhavmarble.inventory.slab.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ProductSlabResponse(
        Long id,
        Long productId,
        String slabCode,
        BigDecimal lengthFt,
        BigDecimal widthFt,
        BigDecimal originalAreaSqft,
        BigDecimal remainingAreaSqft,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
