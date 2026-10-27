package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;

/** How many notes or coins of one denomination were counted at closing. */
@Entity
@Table(name = "cash_count_lines")
@IdClass(CashCountLine.Key.class)
public class CashCountLine {

    @Id
    @Column(name = "session_id")
    private Long sessionId;

    @Id
    @Column(precision = 8, scale = 2)
    private BigDecimal denomination;

    @Column(nullable = false)
    private int quantity;

    protected CashCountLine() {
    }

    public CashCountLine(Long sessionId, BigDecimal denomination, int quantity) {
        this.sessionId = sessionId;
        this.denomination = denomination;
        this.quantity = quantity;
    }

    public Long getSessionId() { return sessionId; }
    public BigDecimal getDenomination() { return denomination; }
    public int getQuantity() { return quantity; }

    public static class Key implements Serializable {
        private Long sessionId;
        private BigDecimal denomination;

        public Key() {
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof Key key && Objects.equals(sessionId, key.sessionId)
                    && denomination != null && key.denomination != null
                    && denomination.compareTo(key.denomination) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hash(sessionId, denomination == null ? null : denomination.stripTrailingZeros());
        }
    }
}
