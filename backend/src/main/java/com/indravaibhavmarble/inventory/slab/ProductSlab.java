
package com.indravaibhavmarble.inventory.slab;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "product_slabs")
public class ProductSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "slab_code", nullable = false, unique = true, length = 80)
    private String slabCode;

    @Column(name = "length_ft", nullable = false, precision = 10, scale = 3)
    private BigDecimal lengthFt;

    @Column(name = "width_ft", nullable = false, precision = 10, scale = 3)
    private BigDecimal widthFt;

    @Column(name = "original_area_sqft", nullable = false, precision = 12, scale = 3)
    private BigDecimal originalAreaSqft;

    @Column(name = "remaining_area_sqft", nullable = false, precision = 12, scale = 3)
    private BigDecimal remainingAreaSqft;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "AVAILABLE";

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    protected ProductSlab() {
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

    public String getSlabCode() {
        return slabCode;
    }

    public void setSlabCode(String slabCode) {
        this.slabCode = slabCode;
    }

    public BigDecimal getLengthFt() {
        return lengthFt;
    }

    public void setLengthFt(BigDecimal lengthFt) {
        this.lengthFt = lengthFt;
    }

    public BigDecimal getWidthFt() {
        return widthFt;
    }

    public void setWidthFt(BigDecimal widthFt) {
        this.widthFt = widthFt;
    }

    public BigDecimal getOriginalAreaSqft() {
        return originalAreaSqft;
    }

    public void setOriginalAreaSqft(BigDecimal originalAreaSqft) {
        this.originalAreaSqft = originalAreaSqft;
    }

    public BigDecimal getRemainingAreaSqft() {
        return remainingAreaSqft;
    }

    public void setRemainingAreaSqft(BigDecimal remainingAreaSqft) {
        this.remainingAreaSqft = remainingAreaSqft;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
