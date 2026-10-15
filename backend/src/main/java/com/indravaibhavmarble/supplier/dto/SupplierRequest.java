
package com.indravaibhavmarble.supplier.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRequest(

        @Size(max = 50)
        String supplierCode,

        @NotBlank(message = "Supplier name is required")
        @Size(max = 150)
        String name,

        @Size(max = 120)
        String contactPerson,

        @Size(max = 20)
        String phone,

        @Size(max = 20)
        String alternatePhone,

        @Email(message = "Enter a valid email address")
        @Size(max = 150)
        String email,

        @Size(max = 15)
        String gstin,

        String addressLine,

        @Size(max = 100)
        String city,

        @Size(max = 100)
        String state,

        @Size(max = 10)
        String postalCode,

        String notes
) {
}
