
package com.indravaibhavmarble.inventory.slab;

import com.indravaibhavmarble.inventory.slab.dto.ProductSlabRequest;
import com.indravaibhavmarble.inventory.slab.dto.ProductSlabResponse;
import org.springframework.http.HttpStatus;
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
    @ResponseStatus(HttpStatus.CREATED)
    public ProductSlabResponse createSlab(
            @RequestBody ProductSlabRequest request) {
        return slabService.createSlab(request);
    }

    @GetMapping("/product/{productId}")
    public List<ProductSlabResponse> getSlabsByProduct(
            @PathVariable Long productId) {
        return slabService.getSlabsByProduct(productId);
    }

    @GetMapping("/{slabId}")
    public ProductSlabResponse getSlabById(
            @PathVariable Long slabId) {
        return slabService.getSlabById(slabId);
    }
}
