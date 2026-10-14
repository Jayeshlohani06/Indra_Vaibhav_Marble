
package com.indravaibhavmarble.product.service;
import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
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
        validateProduct(product);

        if (productRepository.existsByProductCode(
                product.getProductCode())) {
            throw new IllegalArgumentException(
                    "Product code already exists: "
                            + product.getProductCode());
        }

        return productRepository.save(product);
    }

    public Product updateProduct(Long id, Product updatedProduct) {
        Product existing = getProductById(id);

        validateProduct(updatedProduct);

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
        existing.setStockQuantity(updatedProduct.getStockQuantity());
        existing.setLowStockThreshold(
                updatedProduct.getLowStockThreshold());

        return productRepository.save(existing);
    }

    public void deactivateProduct(Long id) {
        Product product = getProductById(id);
        product.setActive(false);
        productRepository.save(product);
    }

    private void validateProduct(Product product) {
        if (product.getProductCode() == null
                || product.getProductCode().isBlank()) {
            throw new IllegalArgumentException(
                    "Product code is required");
        }

        if (product.getName() == null || product.getName().isBlank()) {
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
                "Category not found: " + product.getCategoryId()));

if (!category.isActive()) {
    throw new IllegalArgumentException(
            "Selected category is inactive");
}

MeasurementUnit unit = unitRepository
        .findById(product.getUnitId())
        .orElseThrow(() -> new IllegalArgumentException(
                "Measurement unit not found: " + product.getUnitId()));

if (!unit.isActive()) {
    throw new IllegalArgumentException(
            "Selected measurement unit is inactive");
}

        validateNonNegative(product.getSellingPrice(), "Selling price");
        validateNonNegative(product.getPurchasePrice(), "Purchase price");
        validateNonNegative(product.getGstRate(), "GST rate");
        validateNonNegative(product.getStockQuantity(), "Stock quantity");
        validateNonNegative(
                product.getLowStockThreshold(), "Low-stock threshold");

        if (product.getGstRate().compareTo(
                new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException(
                    "GST rate cannot exceed 100");
        }
    }

    private void validateNonNegative(BigDecimal value, String field) {
        if (value == null || value.signum() < 0) {
            throw new IllegalArgumentException(
                    field + " must be zero or greater");
        }
    }
}
