package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** One business day of the cash drawer, from opening balance to counted close. */
@Entity
@Table(name = "cash_sessions")
public class CashSession {

    public static final String OPEN = "OPEN";
    public static final String CLOSED = "CLOSED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "business_date", nullable = false, unique = true)
    private LocalDate businessDate;

    @Column(nullable = false, length = 20)
    private String status = OPEN;

    @Column(name = "opening_balance", nullable = false, precision = 14, scale = 2)
    private BigDecimal openingBalance;

    @Column(name = "carried_forward", precision = 14, scale = 2)
    private BigDecimal carriedForward;

    @Column(name = "opening_note", length = 500)
    private String openingNote;

    @Column(name = "opened_by", nullable = false)
    private String openedBy;

    @Column(name = "opened_at", nullable = false)
    private OffsetDateTime openedAt;

    @Column(name = "expected_cash", precision = 14, scale = 2)
    private BigDecimal expectedCash;

    @Column(name = "counted_cash", precision = 14, scale = 2)
    private BigDecimal countedCash;

    @Column(precision = 14, scale = 2)
    private BigDecimal difference;

    @Column(name = "closing_note", length = 1000)
    private String closingNote;

    @Column(name = "closed_by")
    private String closedBy;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "close_request_id")
    private UUID closeRequestId;

    @Column(name = "reopen_count", nullable = false)
    private int reopenCount;

    @Version
    @Column(nullable = false)
    private long version;

    public Long getId() { return id; }
    public LocalDate getBusinessDate() { return businessDate; }
    public void setBusinessDate(LocalDate value) { businessDate = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public boolean isClosed() { return CLOSED.equals(status); }
    public BigDecimal getOpeningBalance() { return openingBalance; }
    public void setOpeningBalance(BigDecimal value) { openingBalance = value; }
    public BigDecimal getCarriedForward() { return carriedForward; }
    public void setCarriedForward(BigDecimal value) { carriedForward = value; }
    public String getOpeningNote() { return openingNote; }
    public void setOpeningNote(String value) { openingNote = value; }
    public String getOpenedBy() { return openedBy; }
    public void setOpenedBy(String value) { openedBy = value; }
    public OffsetDateTime getOpenedAt() { return openedAt; }
    public void setOpenedAt(OffsetDateTime value) { openedAt = value; }
    public BigDecimal getExpectedCash() { return expectedCash; }
    public void setExpectedCash(BigDecimal value) { expectedCash = value; }
    public BigDecimal getCountedCash() { return countedCash; }
    public void setCountedCash(BigDecimal value) { countedCash = value; }
    public BigDecimal getDifference() { return difference; }
    public void setDifference(BigDecimal value) { difference = value; }
    public String getClosingNote() { return closingNote; }
    public void setClosingNote(String value) { closingNote = value; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String value) { closedBy = value; }
    public OffsetDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(OffsetDateTime value) { closedAt = value; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String value) { approvedBy = value; }
    public UUID getCloseRequestId() { return closeRequestId; }
    public void setCloseRequestId(UUID value) { closeRequestId = value; }
    public int getReopenCount() { return reopenCount; }
    public void setReopenCount(int value) { reopenCount = value; }
    public long getVersion() { return version; }
}
