
package com.indravaibhavmarble.inventory.slab;

import com.indravaibhavmarble.inventory.entity.InventoryTrackingType;
import com.indravaibhavmarble.inventory.entity.ProductInventorySetting;
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

        String slabCode = request.slabCode() == null
                ? ""
                : request.slabCode().trim();

        if (slabCode.isBlank()) {
            throw new IllegalArgumentException("Slab code is required");
        }

        if (slabCode.length() > 80) {
            throw new IllegalArgumentException(
                    "Slab code must not exceed 80 characters");
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

        Product product = productRepository
                .findByIdForUpdate(request.productId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Product not found with ID: "
                                + request.productId()));

        if (!product.isActive()) {
            throw new IllegalArgumentException(
                    "Cannot register a slab for an inactive product");
        }

        ProductInventorySetting setting = settingRepository
                .findByProductId(request.productId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Configure inventory tracking before registering slabs"));

        if (setting.getTrackingType() != InventoryTrackingType.SLAB) {
            throw new IllegalArgumentException(
                    "The selected product must use SLAB inventory tracking");
        }

        if (slabRepository.existsBySlabCodeIgnoreCase(slabCode)) {
            throw new IllegalArgumentException(
                    "Slab code already exists: " + slabCode);
        }

        BigDecimal area = request.lengthFt()
                .multiply(request.widthFt())
                .setScale(AREA_SCALE, RoundingMode.HALF_UP);

        ProductSlab slab = new ProductSlab();
        slab.setProductId(request.productId());
        slab.setSlabCode(slabCode);
        slab.setLengthFt(request.lengthFt());
        slab.setWidthFt(request.widthFt());
        slab.setOriginalAreaSqft(area);
        slab.setRemainingAreaSqft(area);
        slab.setStatus("AVAILABLE");

        return toResponse(slabRepository.saveAndFlush(slab));
    }

    @Transactional(readOnly = true)
    public List<ProductSlabResponse> getSlabsByProduct(Long productId) {
        if (productId == null) {
            throw new IllegalArgumentException("Product ID is required");
        }

        if (!productRepository.existsById(productId)) {
            throw new IllegalArgumentException(
                    "Product not found with ID: " + productId);
        }

        return slabRepository
                .findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductSlabResponse getSlabById(Long slabId) {
        if (slabId == null) {
            throw new IllegalArgumentException("Slab ID is required");
        }

        ProductSlab slab = slabRepository.findById(slabId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Slab not found with ID: " + slabId));

        return toResponse(slab);
    }

    private ProductSlabResponse toResponse(ProductSlab slab) {
        return new ProductSlabResponse(
                slab.getId(),
                slab.getProductId(),
                slab.getSlabCode(),
                slab.getLengthFt(),
                slab.getWidthFt(),
                slab.getOriginalAreaSqft(),
                slab.getRemainingAreaSqft(),
                slab.getStatus(),
                slab.getCreatedAt(),
                slab.getUpdatedAt()
        );
    }
}
