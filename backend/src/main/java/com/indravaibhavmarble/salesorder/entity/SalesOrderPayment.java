package com.indravaibhavmarble.salesorder.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "sales_order_payments")
public class SalesOrderPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "sales_order_id", nullable = false)
    private Long salesOrderId;
    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod;
    @Column(name = "reference_number", length = 100)
    private String referenceNumber;
    @Column(columnDefinition = "TEXT")
    private String notes;
    /** Set on refunds, which are stored as negative amounts. */
    @Column(name = "sales_return_id")
    private Long salesReturnId;
    @Column(name = "created_by", updatable = false)
    private String createdBy;
    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public Long getSalesOrderId() { return salesOrderId; }
    public void setSalesOrderId(Long value) { salesOrderId = value; }
    public LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(LocalDate value) { paymentDate = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String value) { paymentMethod = value; }
    public String getReferenceNumber() { return referenceNumber; }
    public void setReferenceNumber(String value) { referenceNumber = value; }
    public Long getSalesReturnId() { return salesReturnId; }
    public void setSalesReturnId(Long value) { salesReturnId = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String value) { createdBy = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
