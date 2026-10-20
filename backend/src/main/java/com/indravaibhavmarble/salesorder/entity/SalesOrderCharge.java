package com.indravaibhavmarble.salesorder.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "sales_order_charges")
public class SalesOrderCharge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sales_order_id", nullable = false)
    private Long salesOrderId;

    @Column(nullable = false, length = 120)
    private String description;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    protected SalesOrderCharge() {}

    public static SalesOrderCharge createNew() {
        return new SalesOrderCharge();
    }

    public Long getId() { return id; }
    public Long getSalesOrderId() { return salesOrderId; }
    public void setSalesOrderId(Long value) { salesOrderId = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
}
