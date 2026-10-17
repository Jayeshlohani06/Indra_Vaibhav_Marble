
package com.indravaibhavmarble.purchase.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "purchases")
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "purchase_number", nullable = false, unique = true)
    private String purchaseNumber;

    @Column(name = "supplier_id", nullable = false)
    private Long supplierId;

    @Column(name = "supplier_invoice_number")
    private String supplierInvoiceNumber;

    @Column(name = "purchase_date", nullable = false)
    private LocalDate purchaseDate;

    @Column(nullable = false)
    private String status = "DRAFT";

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "gst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    public Purchase() {
}

    public Long getId() { return id; }

    public String getPurchaseNumber() { return purchaseNumber; }
    public void setPurchaseNumber(String value) { purchaseNumber = value; }

    public Long getSupplierId() { return supplierId; }
    public void setSupplierId(Long value) { supplierId = value; }

    public String getSupplierInvoiceNumber() { return supplierInvoiceNumber; }
    public void setSupplierInvoiceNumber(String value) { supplierInvoiceNumber = value; }

    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate value) { purchaseDate = value; }

    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal value) { subtotal = value; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal value) { discountAmount = value; }

    public BigDecimal getGstAmount() { return gstAmount; }
    public void setGstAmount(BigDecimal value) { gstAmount = value; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal value) { totalAmount = value; }

    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
