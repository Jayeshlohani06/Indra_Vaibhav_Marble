package com.indravaibhavmarble.salesorder.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "sales_return_items")
public class SalesReturnItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "sales_return_id", nullable = false)
    private Long salesReturnId;
    @Column(name = "sales_order_item_id", nullable = false)
    private Long salesOrderItemId;
    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal quantity;
    @Column(name = "secondary_quantity", precision = 14, scale = 3)
    private BigDecimal secondaryQuantity;
    @Column(name = "taxable_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal taxableAmount;
    @Column(name = "cgst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal cgstAmount;
    @Column(name = "sgst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal sgstAmount;
    @Column(name = "igst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal igstAmount;
    @Column(name = "line_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal lineTotal;

    protected SalesReturnItem() {}

    public static SalesReturnItem createNew() {
        return new SalesReturnItem();
    }

    public Long getId() { return id; }
    public Long getSalesReturnId() { return salesReturnId; }
    public void setSalesReturnId(Long value) { salesReturnId = value; }
    public Long getSalesOrderItemId() { return salesOrderItemId; }
    public void setSalesOrderItemId(Long value) { salesOrderItemId = value; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal value) { quantity = value; }
    public BigDecimal getSecondaryQuantity() { return secondaryQuantity; }
    public void setSecondaryQuantity(BigDecimal value) { secondaryQuantity = value; }
    public BigDecimal getTaxableAmount() { return taxableAmount; }
    public void setTaxableAmount(BigDecimal value) { taxableAmount = value; }
    public BigDecimal getCgstAmount() { return cgstAmount; }
    public void setCgstAmount(BigDecimal value) { cgstAmount = value; }
    public BigDecimal getSgstAmount() { return sgstAmount; }
    public void setSgstAmount(BigDecimal value) { sgstAmount = value; }
    public BigDecimal getIgstAmount() { return igstAmount; }
    public void setIgstAmount(BigDecimal value) { igstAmount = value; }
    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal value) { lineTotal = value; }
}
