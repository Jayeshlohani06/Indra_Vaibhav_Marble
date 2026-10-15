
package com.indravaibhavmarble.inventory.dto;

import com.indravaibhavmarble.inventory.entity.ProductInventorySetting;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record InventorySettingResponse(
        Long id,
        Long productId,
        String productCode,
        String productName,
        String trackingType,
        BigDecimal tileLengthFt,
        BigDecimal tileWidthFt,
        Integer piecesPerBox,
        BigDecimal boxCoverageSqft,
        OffsetDateTime createdAt
) {
    public static InventorySettingResponse from(
            ProductInventorySetting setting) {

        return new InventorySettingResponse(
                setting.getId(),
                setting.getProduct().getId(),
                setting.getProduct().getProductCode(),
                setting.getProduct().getName(),
                setting.getTrackingType().name(),
                setting.getTileLengthFt(),
                setting.getTileWidthFt(),
                setting.getPiecesPerBox(),
                setting.getBoxCoverageSqft(),
                setting.getCreatedAt()
        );
    }
}
