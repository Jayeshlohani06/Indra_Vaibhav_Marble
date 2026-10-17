
package com.indravaibhavmarble.inventory.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "product_stock_balances")
public class ProductStockBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, unique = true)
    private Long productId;

    @Column(name = "unopened_boxes", nullable = false, precision = 14, scale = 3)
    private BigDecimal unopenedBoxes = BigDecimal.ZERO;

    @Column(name = "loose_quantity", nullable = false, precision = 14, scale = 3)
    private BigDecimal looseQuantity = BigDecimal.ZERO;

    @Column(name = "whole_bags", nullable = false)
    private Long wholeBags = 0L;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected ProductStockBalance() {
    }

    public Long getId() {
        return id;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public BigDecimal getUnopenedBoxes() {
        return unopenedBoxes;
    }

    public void setUnopenedBoxes(BigDecimal unopenedBoxes) {
        this.unopenedBoxes = unopenedBoxes;
    }

    public BigDecimal getLooseQuantity() {
        return looseQuantity;
    }

    public void setLooseQuantity(BigDecimal looseQuantity) {
        this.looseQuantity = looseQuantity;
    }

    public Long getWholeBags() {
        return wholeBags;
    }

    public void setWholeBags(Long wholeBags) {
        this.wholeBags = wholeBags;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
