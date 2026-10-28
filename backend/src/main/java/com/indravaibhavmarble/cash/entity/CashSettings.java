package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;

/** The single cash settings row; also the lock that orders closings and money entries. */
@Entity
@Table(name = "cash_settings")
public class CashSettings {

    public static final short ID = 1;

    @Id
    private Short id;

    @Column(name = "approval_threshold", nullable = false, precision = 14, scale = 2)
    private BigDecimal approvalThreshold;

    @Column(name = "owner_whatsapp", length = 20)
    private String ownerWhatsapp;

    @Column(name = "closing_reminder_time", nullable = false)
    private LocalTime closingReminderTime;

    @Column(name = "large_expense_threshold", nullable = false, precision = 14, scale = 2)
    private BigDecimal largeExpenseThreshold;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected CashSettings() {
    }

    public Short getId() { return id; }
    public BigDecimal getApprovalThreshold() { return approvalThreshold; }
    public void setApprovalThreshold(BigDecimal value) { approvalThreshold = value; }
    public String getOwnerWhatsapp() { return ownerWhatsapp; }
    public void setOwnerWhatsapp(String value) { ownerWhatsapp = value; }
    public LocalTime getClosingReminderTime() { return closingReminderTime; }
    public void setClosingReminderTime(LocalTime value) { closingReminderTime = value; }
    public BigDecimal getLargeExpenseThreshold() { return largeExpenseThreshold; }
    public void setLargeExpenseThreshold(BigDecimal value) { largeExpenseThreshold = value; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String value) { updatedBy = value; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime value) { updatedAt = value; }
}
