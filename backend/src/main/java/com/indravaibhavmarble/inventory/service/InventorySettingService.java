
package com.indravaibhavmarble.inventory.service;

import com.indravaibhavmarble.inventory.entity.InventoryTrackingType;
import com.indravaibhavmarble.inventory.entity.ProductInventorySetting;
import com.indravaibhavmarble.inventory.repository.ProductInventorySettingRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@Transactional
public class InventorySettingService {

    private static final int COVERAGE_SCALE = 3;

    private final ProductInventorySettingRepository settingRepository;
    private final ProductRepository productRepository;

    public InventorySettingService(
            ProductInventorySettingRepository settingRepository,
            ProductRepository productRepository) {
        this.settingRepository = settingRepository;
        this.productRepository = productRepository;
    }

    public ProductInventorySetting createOrUpdateSetting(
            Long productId,
            InventoryTrackingType trackingType,
            BigDecimal tileLengthFt,
            BigDecimal tileWidthFt,
            Integer piecesPerBox) {

        if (productId == null) {
            throw new IllegalArgumentException("Product ID is required");
        }

        if (trackingType == null) {
            throw new IllegalArgumentException(
                    "Inventory tracking type is required");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Product not found with ID: " + productId));

        BigDecimal boxCoverageSqft = validateAndCalculateCoverage(
                trackingType,
                tileLengthFt,
                tileWidthFt,
                piecesPerBox);

        ProductInventorySetting setting =
                settingRepository.findByProductId(productId)
                        .orElseGet(ProductInventorySetting::new);

        setting.setProduct(product);
        setting.setTrackingType(trackingType);
        setting.setTileLengthFt(tileLengthFt);
        setting.setTileWidthFt(tileWidthFt);
        setting.setPiecesPerBox(piecesPerBox);
        setting.setBoxCoverageSqft(boxCoverageSqft);

        return settingRepository.save(setting);
    }

    @Transactional(readOnly = true)
    public ProductInventorySetting getSetting(Long productId) {
        if (productId == null) {
            throw new IllegalArgumentException("Product ID is required");
        }

        return settingRepository.findByProductId(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Inventory settings not found for product ID: "
                                + productId));
    }

    private BigDecimal validateAndCalculateCoverage(
            InventoryTrackingType trackingType,
            BigDecimal tileLengthFt,
            BigDecimal tileWidthFt,
            Integer piecesPerBox) {

        if (trackingType != InventoryTrackingType.TILE) {
            if (tileLengthFt != null
                    || tileWidthFt != null
                    || piecesPerBox != null) {
                throw new IllegalArgumentException(
                        "Tile dimensions and pieces per box are only "
                                + "applicable to TILE products");
            }

            return null;
        }

        if (tileLengthFt == null || tileLengthFt.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Tile length must be greater than zero");
        }

        if (tileWidthFt == null || tileWidthFt.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Tile width must be greater than zero");
        }

        if (piecesPerBox == null || piecesPerBox <= 0) {
            throw new IllegalArgumentException(
                    "Pieces per box must be greater than zero");
        }

        return tileLengthFt
                .multiply(tileWidthFt)
                .multiply(BigDecimal.valueOf(piecesPerBox))
                .setScale(COVERAGE_SCALE, RoundingMode.HALF_UP);
    }
}
