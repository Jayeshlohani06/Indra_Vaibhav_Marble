
package com.indravaibhavmarble.inventory.slab.dto;

import java.math.BigDecimal;

public record ProductSlabRequest(
        Long productId,
        String slabCode,
        BigDecimal lengthFt,
        BigDecimal widthFt
) {
}
