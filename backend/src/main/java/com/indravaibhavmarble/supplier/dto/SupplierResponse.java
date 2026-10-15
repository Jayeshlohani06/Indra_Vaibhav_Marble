
package com.indravaibhavmarble.supplier.dto;

import java.time.OffsetDateTime;

public record SupplierResponse(
        Long id,
        String supplierCode,
        String name,
        String contactPerson,
        String phone,
        String alternatePhone,
        String email,
        String gstin,
        String addressLine,
        String city,
        String state,
        String postalCode,
        String notes,
        boolean active,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
