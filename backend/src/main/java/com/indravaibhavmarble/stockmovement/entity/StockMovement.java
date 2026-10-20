
package com.indravaibhavmarble.stockmovement.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "movement_type", nullable = false, length = 20)
    private String movementType;

    @Column(name = "quantity_change", nullable = false, precision = 14, scale = 3)
    private BigDecimal quantityChange;

    @Column(name = "stock_before", nullable = false, precision = 14, scale = 3)
    private BigDecimal stockBefore;

    @Column(name = "stock_after", nullable = false, precision = 14, scale = 3)
    private BigDecimal stockAfter;

    @Column(name = "reference_type", length = 30)
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "reference_number", length = 50)
    private String referenceNumber;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected StockMovement() {
    }

    public static StockMovement createNew(
            Long productId,
            String movementType,
            BigDecimal quantityChange,
            BigDecimal stockBefore,
            BigDecimal stockAfter,
            String referenceType,
            Long referenceId,
            String referenceNumber,
            String notes) {

        StockMovement movement = new StockMovement();
        movement.productId = productId;
        movement.movementType = movementType;
        movement.quantityChange = quantityChange;
        movement.stockBefore = stockBefore;
        movement.stockAfter = stockAfter;
        movement.referenceType = referenceType;
        movement.referenceId = referenceId;
        movement.referenceNumber = referenceNumber;
        movement.notes = notes;

        return movement;
    }

    public Long getId() {
        return id;
    }

    public Long getProductId() {
        return productId;
    }

    public String getMovementType() {
        return movementType;
    }

    public BigDecimal getQuantityChange() {
        return quantityChange;
    }

    public BigDecimal getStockBefore() {
        return stockBefore;
    }

    public BigDecimal getStockAfter() {
        return stockAfter;
    }

    public String getReferenceType() {
        return referenceType;
    }

    public Long getReferenceId() {
        return referenceId;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public String getNotes() {
        return notes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public void setMovementType(String movementType) {
        this.movementType = movementType;
    }

    public void setQuantityChange(BigDecimal quantityChange) {
        this.quantityChange = quantityChange;
    }

    public void setReferenceType(String referenceType) {
        this.referenceType = referenceType;
    }

    public void setReferenceId(Long referenceId) {
        this.referenceId = referenceId;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public void setStockBefore(BigDecimal stockBefore) {
        this.stockBefore = stockBefore;
    }

    public void setStockAfter(BigDecimal stockAfter) {
        this.stockAfter = stockAfter;
    }

}
