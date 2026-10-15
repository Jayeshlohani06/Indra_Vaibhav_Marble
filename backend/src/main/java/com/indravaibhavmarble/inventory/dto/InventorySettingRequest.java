
package com.indravaibhavmarble.inventory.dto;

import com.indravaibhavmarble.inventory.entity.InventoryTrackingType;

import java.math.BigDecimal;

public record InventorySettingRequest(
        InventoryTrackingType trackingType,
        BigDecimal tileLengthFt,
        BigDecimal tileWidthFt,
        Integer piecesPerBox
) {
}
