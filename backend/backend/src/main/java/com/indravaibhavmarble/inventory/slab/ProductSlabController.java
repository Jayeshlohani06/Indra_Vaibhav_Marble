
package com.indravaibhavmarble.inventory.slab;

import com.indravaibhavmarble.inventory.slab.dto.ProductSlabRequest;
import com.indravaibhavmarble.inventory.slab.dto.ProductSlabResponse;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inventory/slabs")
public class ProductSlabController {

    private final ProductSlabService slabService;

    public ProductSlabController(ProductSlabService slabService) {
        this.slabService = slabService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductSlabResponse createSlab(
            @RequestBody ProductSlabRequest request) {
        return slabService.createSlab(request);
    }

    @GetMapping("/product/{productId}")
    public List<ProductSlabResponse> getSlabs(
            @PathVariable Long productId) {
        return slabService.getSlabs(productId);
    }

    @GetMapping("/{slabId}")
    public ProductSlabResponse getSlab(
            @PathVariable Long slabId) {
        return slabService.getSlab(slabId);
    }
}
