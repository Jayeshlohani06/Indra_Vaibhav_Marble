package com.indravaibhavmarble.salesorder.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Goods taken back on a bill. A cancellation is the final return of everything left. */
@Entity
@Table(name = "sales_returns")
public class SalesReturn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "sales_order_id", nullable = false)
    private Long salesOrderId;
    @Column(name = "return_number", nullable = false, unique = true, length = 40)
    private String returnNumber;
    @Column(name = "return_date", nullable = false)
    private LocalDate returnDate;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;
    @Column(name = "cancels_order", nullable = false)
    private boolean cancelsOrder;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;
    @Column(name = "cgst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal cgstAmount = BigDecimal.ZERO;
    @Column(name = "sgst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal sgstAmount = BigDecimal.ZERO;
    @Column(name = "igst_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal igstAmount = BigDecimal.ZERO;
    @Column(name = "charges_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal chargesAmount = BigDecimal.ZERO;
    @Column(name = "total_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;
    @Column(name = "refund_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;
    @Column(name = "created_by")
    private String createdBy;
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected SalesReturn() {}

    public static SalesReturn createNew() {
        return new SalesReturn();
    }

    public Long getId() { return id; }
    public Long getSalesOrderId() { return salesOrderId; }
    public void setSalesOrderId(Long value) { salesOrderId = value; }
    public String getReturnNumber() { return returnNumber; }
    public void setReturnNumber(String value) { returnNumber = value; }
    public LocalDate getReturnDate() { return returnDate; }
    public void setReturnDate(LocalDate value) { returnDate = value; }
    public String getReason() { return reason; }
    public void setReason(String value) { reason = value; }
    public boolean isCancelsOrder() { return cancelsOrder; }
    public void setCancelsOrder(boolean value) { cancelsOrder = value; }
    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal value) { subtotal = value; }
    public BigDecimal getCgstAmount() { return cgstAmount; }
    public void setCgstAmount(BigDecimal value) { cgstAmount = value; }
    public BigDecimal getSgstAmount() { return sgstAmount; }
    public void setSgstAmount(BigDecimal value) { sgstAmount = value; }
    public BigDecimal getIgstAmount() { return igstAmount; }
    public void setIgstAmount(BigDecimal value) { igstAmount = value; }
    public BigDecimal getTotalTax() { return cgstAmount.add(sgstAmount).add(igstAmount); }
    public BigDecimal getChargesAmount() { return chargesAmount; }
    public void setChargesAmount(BigDecimal value) { chargesAmount = value; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal value) { totalAmount = value; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(BigDecimal value) { refundAmount = value; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String value) { createdBy = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
