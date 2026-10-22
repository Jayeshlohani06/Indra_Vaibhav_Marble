
package com.indravaibhavmarble.product.service;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final MeasurementUnitRepository unitRepository;

    public ProductService(
            ProductRepository productRepository,
            ProductCategoryRepository categoryRepository,
            MeasurementUnitRepository unitRepository) {

        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.unitRepository = unitRepository;
    }

    @Transactional(readOnly = true)
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Product getProductById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Product not found with ID: " + id));
    }

    public Product createProduct(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Product details are required");
        }

        if (product.getProductCode() == null
                || product.getProductCode().isBlank()) {
            product.setProductCode(generateProductCode(product.getName()));
        } else {
            product.setProductCode(product.getProductCode().trim());
        }

        // Product creation defines catalogue data only. Stock enters through
        // purchases or the stock movement workflow.
        product.setStockQuantity(BigDecimal.ZERO);
        validateProduct(product, true);

        if (productRepository.existsByProductCode(
                product.getProductCode())) {
            throw new IllegalArgumentException(
                    "Product code already exists: "
                            + product.getProductCode());
        }

        return productRepository.save(product);
    }

    private String generateProductCode(String name) {
        String prefix = name.toUpperCase()
                .replaceAll("[^A-Z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (prefix.isBlank()) {
            prefix = "PRODUCT";
        }
        prefix = prefix.substring(0, Math.min(prefix.length(), 35));

        String code = prefix;
        int suffix = 1;
        while (productRepository.existsByProductCode(code)) {
            code = prefix + "-" + suffix++;
        }
        return code;
    }

    public Product updateProduct(Long id, Product updatedProduct) {
        Product existing = getProductById(id);

        // Validate product details without changing existing stock.
        validateProduct(updatedProduct, false);

        productRepository.findByProductCode(
                updatedProduct.getProductCode()
        ).ifPresent(product -> {
            if (!product.getId().equals(id)) {
                throw new IllegalArgumentException(
                        "Product code already exists: "
                                + updatedProduct.getProductCode());
            }
        });

        existing.setProductCode(updatedProduct.getProductCode());
        existing.setName(updatedProduct.getName());
        existing.setDescription(updatedProduct.getDescription());
        existing.setCategoryId(updatedProduct.getCategoryId());
        existing.setUnitId(updatedProduct.getUnitId());
        existing.setSellingPrice(updatedProduct.getSellingPrice());
        existing.setPurchasePrice(updatedProduct.getPurchasePrice());
        existing.setGstRate(updatedProduct.getGstRate());
        existing.setLowStockThreshold(
                updatedProduct.getLowStockThreshold());

        // Intentionally do not update stockQuantity here.
        // Stock changes must use the stock movement workflow.

        return productRepository.save(existing);
    }

    public void deactivateProduct(Long id) {
        Product product = getProductById(id);
        product.setActive(false);
        productRepository.save(product);
    }

    private void validateProduct(
            Product product,
            boolean validateStockQuantity) {

        if (product == null) {
            throw new IllegalArgumentException(
                    "Product details are required");
        }

        if (product.getProductCode() == null
                || product.getProductCode().isBlank()) {
            throw new IllegalArgumentException(
                    "Product code is required");
        }

        if (product.getName() == null
                || product.getName().isBlank()) {
            throw new IllegalArgumentException(
                    "Product name is required");
        }

        if (product.getCategoryId() == null
                || product.getUnitId() == null) {
            throw new IllegalArgumentException(
                    "Category and measurement unit are required");
        }

        ProductCategory category = categoryRepository
                .findById(product.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Category not found: "
                                + product.getCategoryId()));

        if (!category.isActive()) {
            throw new IllegalArgumentException(
                    "Selected category is inactive");
        }

        MeasurementUnit unit = unitRepository
                .findById(product.getUnitId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Measurement unit not found: "
                                + product.getUnitId()));

        if (!unit.isActive()) {
            throw new IllegalArgumentException(
                    "Selected measurement unit is inactive");
        }

        validateNonNegative(
                product.getSellingPrice(), "Selling price");
        validateNonNegative(
                product.getPurchasePrice(), "Purchase price");
        validateNonNegative(
                product.getGstRate(), "GST rate");

        if (validateStockQuantity) {
            validateNonNegative(
                    product.getStockQuantity(), "Stock quantity");
        }

        validateNonNegative(
                product.getLowStockThreshold(), "Low-stock threshold");

        if (product.getGstRate().compareTo(
                new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException(
                    "GST rate cannot exceed 100");
        }
    }

    private void validateNonNegative(
            BigDecimal value,
            String field) {

        if (value == null || value.signum() < 0) {
            throw new IllegalArgumentException(
                    field + " must be zero or greater");
        }
    }
}
