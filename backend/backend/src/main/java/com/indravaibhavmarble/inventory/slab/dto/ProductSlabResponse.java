
package com.indravaibhavmarble.inventory.slab.dto;

import com.indravaibhavmarble.inventory.slab.ProductSlab;

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
        OffsetDateTime updatedAt) {

    public static ProductSlabResponse from(ProductSlab slab) {
        return new ProductSlabResponse(
                slab.getId(),
                slab.getProductId(),
                slab.getSlabCode(),
                slab.getLengthFt(),
                slab.getWidthFt(),
                slab.getOriginalAreaSqft(),
                slab.getRemainingAreaSqft(),
                slab.getStatus(),
                slab.getCreatedAt(),
                slab.getUpdatedAt());
    }
}
