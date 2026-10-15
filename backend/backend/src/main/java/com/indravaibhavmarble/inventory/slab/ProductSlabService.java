
package com.indravaibhavmarble.inventory.slab;

import com.indravaibhavmarble.inventory.entity.InventoryTrackingType;
import com.indravaibhavmarble.inventory.repository.ProductInventorySettingRepository;
import com.indravaibhavmarble.inventory.slab.dto.ProductSlabRequest;
import com.indravaibhavmarble.inventory.slab.dto.ProductSlabResponse;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@Transactional
public class ProductSlabService {

    private static final int AREA_SCALE = 3;

    private final ProductSlabRepository slabRepository;
    private final ProductRepository productRepository;
    private final ProductInventorySettingRepository settingRepository;

    public ProductSlabService(
            ProductSlabRepository slabRepository,
            ProductRepository productRepository,
            ProductInventorySettingRepository settingRepository) {
        this.slabRepository = slabRepository;
        this.productRepository = productRepository;
        this.settingRepository = settingRepository;
    }

    public ProductSlabResponse createSlab(ProductSlabRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Slab details are required");
        }

        if (request.productId() == null) {
            throw new IllegalArgumentException("Product ID is required");
        }

        if (request.slabCode() == null || request.slabCode().isBlank()) {
            throw new IllegalArgumentException("Slab code is required");
        }

        String slabCode = request.slabCode().trim();

        if (slabCode.length() > 80) {
            throw new IllegalArgumentException(
                    "Slab code cannot exceed 80 characters");
        }

        if (request.lengthFt() == null
                || request.lengthFt().signum() <= 0) {
            throw new IllegalArgumentException(
                    "Slab length must be greater than zero");
        }

        if (request.widthFt() == null
                || request.widthFt().signum() <= 0) {
            throw new IllegalArgumentException(
                    "Slab width must be greater than zero");
        }

        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Product not found with ID: " + request.productId()));

        if (!product.isActive()) {
            throw new IllegalArgumentException(
                    "Cannot register a slab for an inactive product");
        }

        var setting = settingRepository.findByProductId(request.productId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Configure inventory tracking before registering slabs"));

        if (setting.getTrackingType() != InventoryTrackingType.SLAB) {
            throw new IllegalArgumentException(
                    "The selected product must use SLAB inventory tracking");
        }

        if (slabRepository.existsBySlabCodeIgnoreCase(slabCode)) {
            throw new IllegalArgumentException(
                    "A slab with this code already exists");
        }

        BigDecimal length = request.lengthFt()
                .setScale(3, RoundingMode.HALF_UP);
        BigDecimal width = request.widthFt()
                .setScale(3, RoundingMode.HALF_UP);

        BigDecimal area = length.multiply(width)
                .setScale(AREA_SCALE, RoundingMode.HALF_UP);

        ProductSlab slab = new ProductSlab();
        slab.setProductId(request.productId());
        slab.setSlabCode(slabCode);
        slab.setLengthFt(length);
        slab.setWidthFt(width);
        slab.setOriginalAreaSqft(area);
        slab.setRemainingAreaSqft(area);
        slab.setStatus("AVAILABLE");

        return ProductSlabResponse.from(slabRepository.save(slab));
    }

    @Transactional(readOnly = true)
    public List<ProductSlabResponse> getSlabs(Long productId) {
        if (productId == null || !productRepository.existsById(productId)) {
            throw new IllegalArgumentException("Valid product ID is required");
        }

        return slabRepository
                .findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(ProductSlabResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductSlabResponse getSlab(Long slabId) {
        return ProductSlabResponse.from(
                slabRepository.findById(slabId)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Slab not found with ID: " + slabId)));
    }
}
