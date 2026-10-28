package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;

/** UPI or bank total read from the app/statement when a day was closed. */
@Entity
@Table(name = "cash_digital_checks")
@IdClass(CashDigitalCheck.Key.class)
public class CashDigitalCheck {

    @Id
    @Column(name = "session_id")
    private Long sessionId;

    @Id
    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    @Column(name = "reported_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal reportedAmount;

    protected CashDigitalCheck() {
    }

    public CashDigitalCheck(Long sessionId, String paymentMethod, BigDecimal reportedAmount) {
        this.sessionId = sessionId;
        this.paymentMethod = paymentMethod;
        this.reportedAmount = reportedAmount;
    }

    public Long getSessionId() { return sessionId; }
    public String getPaymentMethod() { return paymentMethod; }
    public BigDecimal getReportedAmount() { return reportedAmount; }

    public static class Key implements Serializable {
        private Long sessionId;
        private String paymentMethod;

        public Key() {
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof Key key && Objects.equals(sessionId, key.sessionId)
                    && Objects.equals(paymentMethod, key.paymentMethod);
        }

        @Override
        public int hashCode() {
            return Objects.hash(sessionId, paymentMethod);
        }
    }
}
