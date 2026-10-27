package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Cash put into or taken out of the drawer that is not a sale, payment or
 * expense: owner cash, bank deposits/withdrawals and approved corrections.
 */
@Entity
@Table(name = "cash_movements")
public class CashMovement {

    public static final Set<String> INFLOW_TYPES = Set.of("OWNER_CASH_IN", "BANK_WITHDRAWAL", "ADJUSTMENT_IN");
    public static final Set<String> OUTFLOW_TYPES = Set.of("OWNER_CASH_OUT", "BANK_DEPOSIT", "ADJUSTMENT_OUT");
    public static final Set<String> ADJUSTMENT_TYPES = Set.of("ADJUSTMENT_IN", "ADJUSTMENT_OUT");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "movement_date", nullable = false)
    private LocalDate movementDate;

    @Column(name = "movement_type", nullable = false, length = 30)
    private String movementType;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "request_id", unique = true)
    private UUID requestId;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "voided_by")
    private String voidedBy;

    @Column(name = "voided_at")
    private OffsetDateTime voidedAt;

    @Column(name = "void_reason", length = 500)
    private String voidReason;

    public Long getId() { return id; }
    public LocalDate getMovementDate() { return movementDate; }
    public void setMovementDate(LocalDate value) { movementDate = value; }
    public String getMovementType() { return movementType; }
    public void setMovementType(String value) { movementType = value; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal value) { amount = value; }
    public String getReferenceNumber() { return referenceNumber; }
    public void setReferenceNumber(String value) { referenceNumber = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public UUID getRequestId() { return requestId; }
    public void setRequestId(UUID value) { requestId = value; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String value) { createdBy = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String value) { approvedBy = value; }
    public String getVoidedBy() { return voidedBy; }
    public void setVoidedBy(String value) { voidedBy = value; }
    public OffsetDateTime getVoidedAt() { return voidedAt; }
    public void setVoidedAt(OffsetDateTime value) { voidedAt = value; }
    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String value) { voidReason = value; }
}
