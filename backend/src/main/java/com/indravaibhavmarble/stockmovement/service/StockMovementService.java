
package com.indravaibhavmarble.stockmovement.service;

import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.stockmovement.dto.StockMovementResponse;
import com.indravaibhavmarble.stockmovement.entity.StockMovement;
import com.indravaibhavmarble.stockmovement.repository.StockMovementRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class StockMovementService {

    private static final List<String> ALLOWED_MOVEMENT_TYPES =
            List.of("SALE", "PURCHASE", "ADJUSTMENT", "REVERSAL");

    private final StockMovementRepository stockMovementRepository;
    private final ProductRepository productRepository;

    public StockMovementService(
            StockMovementRepository stockMovementRepository,
            ProductRepository productRepository) {
        this.stockMovementRepository = stockMovementRepository;
        this.productRepository = productRepository;
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> getAllMovements() {
        return stockMovementRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(StockMovementResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> getMovementsByProduct(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new IllegalArgumentException(
                    "Product not found with ID: " + productId);
        }

        return stockMovementRepository
                .findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(StockMovementResponse::from)
                .toList();
    }

    /**
     * Records a movement and updates stock.
     * Use this for a stock change that has NOT already been applied.
     */
    public StockMovementResponse recordMovement(StockMovement requestedMovement) {
        validateMovement(requestedMovement);

        Product product = productRepository
                .findByIdForUpdate(requestedMovement.getProductId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Product not found with ID: "
                                + requestedMovement.getProductId()));

        BigDecimal stockBefore = product.getStockQuantity();
        BigDecimal quantityChange = requestedMovement.getQuantityChange();

        if (stockBefore == null) {
            throw new IllegalArgumentException(
                    "Current product stock is not available");
        }

        BigDecimal stockAfter = stockBefore.add(quantityChange);

        if (stockAfter.signum() < 0) {
            throw new IllegalArgumentException(
                    "Stock quantity cannot become negative");
        }

        product.setStockQuantity(stockAfter);
        productRepository.save(product);

        requestedMovement.setStockBefore(stockBefore);
        requestedMovement.setStockAfter(stockAfter);

        return StockMovementResponse.from(
                stockMovementRepository.save(requestedMovement));
    }

    /**
     * Records a stock change that has ALREADY been applied by the sales
     * service. This method must not deduct stock a second time.
     */
    public StockMovementResponse recordMovementForExistingStockChange(
            Long productId,
            BigDecimal quantityChange,
            BigDecimal stockBefore,
            BigDecimal stockAfter,
            String referenceType,
            Long referenceId,
            String referenceNumber,
            String notes) {

        if (productId == null
                || quantityChange == null
                || stockBefore == null
                || stockAfter == null) {
            throw new IllegalArgumentException(
                    "Product and stock movement values are required");
        }

        if (quantityChange.signum() == 0
                || stockBefore.signum() < 0
                || stockAfter.signum() < 0
                || stockBefore.add(quantityChange).compareTo(stockAfter) != 0) {
            throw new IllegalArgumentException(
                    "Invalid stock movement quantities");
        }

        if (!productRepository.existsById(productId)) {
            throw new IllegalArgumentException(
                    "Product not found with ID: " + productId);
        }

        String movementType = "SALE".equals(referenceType)
                || "SALES_ORDER".equals(referenceType)
                ? "SALE"
                : null;

        if (movementType == null) {
            throw new IllegalArgumentException(
                    "Unsupported reference type for an existing stock change");
        }

        StockMovement movement = StockMovement.createNew(
                productId,
                movementType,
                quantityChange,
                stockBefore,
                stockAfter,
                referenceType,
                referenceId,
                referenceNumber,
                notes);

        return StockMovementResponse.from(
                stockMovementRepository.save(movement));
    }

    private void validateMovement(StockMovement movement) {
        if (movement == null) {
            throw new IllegalArgumentException(
                    "Stock movement is required");
        }

        if (movement.getProductId() == null) {
            throw new IllegalArgumentException(
                    "Product ID is required");
        }

        if (!ALLOWED_MOVEMENT_TYPES.contains(movement.getMovementType())) {
            throw new IllegalArgumentException(
                    "Unsupported stock movement type");
        }

        if (movement.getQuantityChange() == null
                || movement.getQuantityChange().signum() == 0) {
            throw new IllegalArgumentException(
                    "Quantity change must not be zero");
        }
    }
}
