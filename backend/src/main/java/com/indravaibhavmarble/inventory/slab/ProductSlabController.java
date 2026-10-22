
package com.indravaibhavmarble.inventory.slab;

import com.indravaibhavmarble.inventory.slab.dto.ProductSlabRequest;
import com.indravaibhavmarble.inventory.slab.dto.ProductSlabResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory/slabs")
public class ProductSlabController {

    private final ProductSlabService slabService;

    public ProductSlabController(ProductSlabService slabService) {
        this.slabService = slabService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('INVENTORY_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductSlabResponse createSlab(
            @RequestBody ProductSlabRequest request) {
        return slabService.createSlab(request);
    }

    @GetMapping("/product/{productId}")
    @PreAuthorize("hasAuthority('INVENTORY_READ')")
    public List<ProductSlabResponse> getSlabsByProduct(
            @PathVariable Long productId) {
        return slabService.getSlabsByProduct(productId);
    }

    @GetMapping("/{slabId}")
    @PreAuthorize("hasAuthority('INVENTORY_READ')")
    public ProductSlabResponse getSlabById(
            @PathVariable Long slabId) {
        return slabService.getSlabById(slabId);
    }
}
