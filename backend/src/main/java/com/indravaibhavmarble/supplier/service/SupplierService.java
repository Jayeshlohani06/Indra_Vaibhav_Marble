
package com.indravaibhavmarble.supplier.service;

import com.indravaibhavmarble.supplier.dto.SupplierRequest;
import com.indravaibhavmarble.supplier.dto.SupplierResponse;
import com.indravaibhavmarble.supplier.entity.Supplier;
import com.indravaibhavmarble.supplier.mapper.SupplierMapper;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final SupplierMapper supplierMapper;

    public SupplierService(
            SupplierRepository supplierRepository,
            SupplierMapper supplierMapper
    ) {
        this.supplierRepository = supplierRepository;
        this.supplierMapper = supplierMapper;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> getAllSuppliers() {
        return supplierRepository.findAll()
                .stream()
                .filter(Supplier::isActive)
                .sorted((a, b) -> a.getName()
                        .compareToIgnoreCase(b.getName()))
                .map(supplierMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse getSupplierById(Long id) {
        return supplierMapper.toResponse(getActiveSupplier(id));
    }

    public SupplierResponse createSupplier(SupplierRequest request) {
        validateSupplier(request, null);

        Supplier supplier = supplierMapper.toEntity(request);

        return supplierMapper.toResponse(
                supplierRepository.save(supplier)
        );
    }

    public SupplierResponse updateSupplier(
            Long id,
            SupplierRequest request
    ) {
        Supplier existing = getActiveSupplier(id);

        validateSupplier(request, id);
        supplierMapper.updateEntity(existing, request);

        return supplierMapper.toResponse(
                supplierRepository.save(existing)
        );
    }

    public void deactivateSupplier(Long id) {
        Supplier supplier = getActiveSupplier(id);
        supplier.setActive(false);
        supplierRepository.save(supplier);
    }

    private Supplier getActiveSupplier(Long id) {
        return supplierRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Active supplier not found with ID: " + id
                        ));
    }

    private void validateSupplier(
            SupplierRequest request,
            Long currentSupplierId
    ) {
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException(
                    "Supplier name is required"
            );
        }

        String supplierCode = normalize(request.supplierCode());

        if (supplierCode != null) {
            supplierRepository.findBySupplierCode(supplierCode)
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(currentSupplierId)) {
                            throw new IllegalArgumentException(
                                    "Supplier code already exists: "
                                            + supplierCode
                            );
                        }
                    });
        }

        String gstin = normalize(request.gstin());

        if (gstin != null) {
            String normalizedGstin = gstin.toUpperCase(Locale.ROOT);

            supplierRepository.findByGstinIgnoreCase(normalizedGstin)
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(currentSupplierId)) {
                            throw new IllegalArgumentException(
                                    "GSTIN already exists: "
                                            + normalizedGstin
                            );
                        }
                    });
        }
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }
}
