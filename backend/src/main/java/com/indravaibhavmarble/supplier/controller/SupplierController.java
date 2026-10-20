
package com.indravaibhavmarble.supplier.controller;

import com.indravaibhavmarble.supplier.dto.SupplierRequest;
import com.indravaibhavmarble.supplier.dto.SupplierResponse;
import com.indravaibhavmarble.supplier.service.SupplierService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public List<SupplierResponse> getAllSuppliers(
            @RequestParam(defaultValue = "ACTIVE") String status) {
        return supplierService.getSuppliers(status);
    }

    @GetMapping("/{id}")
    public SupplierResponse getSupplierById(@PathVariable Long id) {
        return supplierService.getSupplierById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierResponse createSupplier(
            @Valid @RequestBody SupplierRequest request
    ) {
        return supplierService.createSupplier(request);
    }

    @PutMapping("/{id}")
    public SupplierResponse updateSupplier(
            @PathVariable Long id,
            @Valid @RequestBody SupplierRequest request
    ) {
        return supplierService.updateSupplier(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateSupplier(@PathVariable Long id) {
        supplierService.deactivateSupplier(id);
    }

    @PostMapping("/{id}/reactivate")
    public SupplierResponse reactivateSupplier(@PathVariable Long id) {
        return supplierService.reactivateSupplier(id);
    }
}
