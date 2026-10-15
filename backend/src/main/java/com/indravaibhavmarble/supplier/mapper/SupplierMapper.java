
package com.indravaibhavmarble.supplier.mapper;

import com.indravaibhavmarble.supplier.dto.SupplierRequest;
import com.indravaibhavmarble.supplier.dto.SupplierResponse;
import com.indravaibhavmarble.supplier.entity.Supplier;
import org.springframework.stereotype.Component;

@Component
public class SupplierMapper {

    public Supplier toEntity(SupplierRequest request) {
        Supplier supplier = new Supplier();
        updateEntity(supplier, request);
        return supplier;
    }

    public void updateEntity(
            Supplier supplier,
            SupplierRequest request
    ) {
        supplier.setSupplierCode(normalize(request.supplierCode()));
        supplier.setName(request.name().trim());
        supplier.setContactPerson(normalize(request.contactPerson()));
        supplier.setPhone(normalize(request.phone()));
        supplier.setAlternatePhone(normalize(request.alternatePhone()));
        supplier.setEmail(normalize(request.email()));
        supplier.setGstin(normalize(request.gstin()));
        supplier.setAddressLine(normalize(request.addressLine()));
        supplier.setCity(normalize(request.city()));
        supplier.setState(normalize(request.state()));
        supplier.setPostalCode(normalize(request.postalCode()));
        supplier.setNotes(normalize(request.notes()));
    }

    public SupplierResponse toResponse(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getName(),
                supplier.getContactPerson(),
                supplier.getPhone(),
                supplier.getAlternatePhone(),
                supplier.getEmail(),
                supplier.getGstin(),
                supplier.getAddressLine(),
                supplier.getCity(),
                supplier.getState(),
                supplier.getPostalCode(),
                supplier.getNotes(),
                supplier.isActive(),
                supplier.getCreatedAt(),
                supplier.getUpdatedAt()
        );
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }
}
