
package com.indravaibhavmarble.purchase.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "purchase_items")
public class PurchaseItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "purchase_id", nullable = false)
    private Long purchaseId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "product_code", nullable = false)
    private String productCode;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal quantity;

    @Column(name = "purchase_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal purchaseRate;

    @Column(name = "discount_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "gst_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal gstRate = BigDecimal.ZERO;

    @Column(name = "gst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "line_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal lineTotal;

    public PurchaseItem() {
}

    public Long getId() { return id; }

    public Long getPurchaseId() { return purchaseId; }
    public void setPurchaseId(Long value) { purchaseId = value; }

    public Long getProductId() { return productId; }
    public void setProductId(Long value) { productId = value; }

    public String getProductCode() { return productCode; }
    public void setProductCode(String value) { productCode = value; }

    public String getProductName() { return productName; }
    public void setProductName(String value) { productName = value; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal value) { quantity = value; }

    public BigDecimal getPurchaseRate() { return purchaseRate; }
    public void setPurchaseRate(BigDecimal value) { purchaseRate = value; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal value) { discountAmount = value; }

    public BigDecimal getGstRate() { return gstRate; }
    public void setGstRate(BigDecimal value) { gstRate = value; }

    public BigDecimal getGstAmount() { return gstAmount; }
    public void setGstAmount(BigDecimal value) { gstAmount = value; }

    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal value) { lineTotal = value; }
}
