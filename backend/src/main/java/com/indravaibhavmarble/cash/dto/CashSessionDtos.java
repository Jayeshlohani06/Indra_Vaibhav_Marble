package com.indravaibhavmarble.cash.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Requests and responses for opening, closing and reviewing cash days. */
public final class CashSessionDtos {

    private CashSessionDtos() {
    }

    public record OpenRequest(BigDecimal openingBalance, String note) {
    }

    public record CountLine(BigDecimal denomination, Integer quantity) {
    }

    /**
     * @param expectedCash the expected cash the person saw while counting; if
     *                     entries changed since, the close is refused so they
     *                     can review again
     * @param requestId    makes a retried close (after a network error) safe
     */
    public record CloseRequest(List<CountLine> counts, String note, BigDecimal expectedCash,
            UUID requestId, List<DigitalTotal> digitalTotals) {

        public CloseRequest(List<CountLine> counts, String note, BigDecimal expectedCash, UUID requestId) {
            this(counts, note, expectedCash, requestId, null);
        }
    }

    /** What the UPI app or bank statement showed as received for the day. */
    public record DigitalTotal(String paymentMethod, BigDecimal amount) {
    }

    /** Received per the app's payments vs. what the person read from the UPI app / bank. */
    public record DigitalCheck(String paymentMethod, BigDecimal recorded, BigDecimal reported,
            BigDecimal difference) {
    }

    public record ReopenRequest(String reason) {
    }

    /** Fields left null keep their current value. */
    public record SettingsRequest(BigDecimal approvalThreshold, String ownerWhatsapp,
            LocalTime closingReminderTime, BigDecimal largeExpenseThreshold) {
    }

    public record SettingsResponse(BigDecimal approvalThreshold, String ownerWhatsapp,
            LocalTime closingReminderTime, BigDecimal largeExpenseThreshold) {
    }

    public record SessionResponse(
            Long id,
            LocalDate businessDate,
            LocalDate periodStart,
            String status,
            BigDecimal openingBalance,
            BigDecimal carriedForward,
            String openingNote,
            String openedBy,
            OffsetDateTime openedAt,
            BigDecimal expectedCash,
            BigDecimal countedCash,
            BigDecimal difference,
            String closingNote,
            String closedBy,
            OffsetDateTime closedAt,
            String approvedBy,
            int reopenCount,
            List<CountLine> counts
    ) {
    }

    public record AuditEntry(String action, String actor, OffsetDateTime occurredAt, String reason) {
    }

    public record SessionDetail(
            SessionResponse session,
            CashSummary summary,
            List<LedgerLine> lines,
            List<AuditEntry> history,
            List<DigitalCheck> digitalChecks
    ) {
    }

    /** Everything the closing screen needs for today. */
    public record TodayResponse(
            LocalDate today,
            LocalDate lockedThrough,
            SessionDetail openSession,
            SessionResponse lastClosed,
            BigDecimal suggestedOpening,
            BigDecimal approvalThreshold,
            List<BigDecimal> denominations,
            SettingsResponse settings,
            boolean closingReminderDue
    ) {
    }
}
