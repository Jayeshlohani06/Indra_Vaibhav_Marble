package com.indravaibhavmarble.cash.service;

import static com.indravaibhavmarble.cash.service.CashPeriodGuard.DISPLAY_DATE;

import com.indravaibhavmarble.cash.dto.CashSessionDtos.AuditEntry;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.CloseRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.CountLine;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.OpenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.ReopenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SessionDetail;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SessionResponse;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SettingsRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.TodayResponse;
import com.indravaibhavmarble.cash.dto.CashSummary;
import com.indravaibhavmarble.cash.dto.LedgerLine;
import com.indravaibhavmarble.cash.entity.CashCountLine;
import com.indravaibhavmarble.cash.entity.CashSession;
import com.indravaibhavmarble.cash.entity.CashSettings;
import com.indravaibhavmarble.cash.repository.CashCountLineRepository;
import com.indravaibhavmarble.cash.repository.CashSessionRepository;
import com.indravaibhavmarble.cash.repository.CashSettingsRepository;
import com.indravaibhavmarble.cash.repository.FinancialAuditRepository;
import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.common.security.CurrentUser;
import com.indravaibhavmarble.common.time.BusinessDate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opens, closes and reopens the cash drawer's business days.
 *
 * <p>Each day covers every entry dated after the previous recorded day up to
 * its own date, so entries on days the shop never opened (a Sunday, say) are
 * counted on the next day instead of being lost. Opening, closing and
 * reopening all take the exclusive cash lock, so they run one at a time and
 * never alongside a money entry.
 */
@Service
@Transactional
public class CashSessionService {

    public static final List<BigDecimal> DENOMINATIONS = List.of(
            new BigDecimal("500"), new BigDecimal("200"), new BigDecimal("100"),
            new BigDecimal("50"), new BigDecimal("20"), new BigDecimal("10"),
            new BigDecimal("5"), new BigDecimal("2"), new BigDecimal("1"));
    private static final int MAX_PIECES = 100_000;
    private static final String ENTITY = "CASH_SESSION";

    private final CashSessionRepository sessionRepository;
    private final CashCountLineRepository countRepository;
    private final CashSettingsRepository settingsRepository;
    private final FinancialAuditRepository auditRepository;
    private final CashLedgerService ledgerService;
    private final FinancialAuditService auditService;

    public CashSessionService(CashSessionRepository sessionRepository,
            CashCountLineRepository countRepository,
            CashSettingsRepository settingsRepository,
            FinancialAuditRepository auditRepository,
            CashLedgerService ledgerService,
            FinancialAuditService auditService) {
        this.sessionRepository = sessionRepository;
        this.countRepository = countRepository;
        this.settingsRepository = settingsRepository;
        this.auditRepository = auditRepository;
        this.ledgerService = ledgerService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public TodayResponse today() {
        CashSettings settings = settingsRepository.findById(CashSettings.ID).orElseThrow();
        SessionDetail open = sessionRepository.findFirstByStatus(CashSession.OPEN)
                .map(this::detail).orElse(null);
        SessionResponse lastClosed = sessionRepository.findFirstByOrderByBusinessDateDesc()
                .filter(CashSession::isClosed)
                .map(this::toResponse).orElse(null);
        return new TodayResponse(BusinessDate.today(), sessionRepository.findLockedThrough(),
                open, lastClosed, lastClosed == null ? null : lastClosed.countedCash(),
                settings.getApprovalThreshold(), DENOMINATIONS);
    }

    public SessionDetail open(OpenRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Opening details are required.");
        }
        BigDecimal opening = money(request.openingBalance(), "Opening cash", true);
        settingsRepository.lockForClosing();
        LocalDate today = BusinessDate.today();

        sessionRepository.findFirstByStatus(CashSession.OPEN).ifPresent(open -> {
            throw new IllegalArgumentException(open.getBusinessDate().equals(today)
                    ? "Today is already open."
                    : "The day " + open.getBusinessDate().format(DISPLAY_DATE)
                            + " is still open. Count the cash and close it first.");
        });
        sessionRepository.findByBusinessDate(today).ifPresent(closed -> {
            throw new IllegalArgumentException("Today was already closed by " + closed.getClosedBy()
                    + ". Ask the owner to reopen it if more entries are needed.");
        });

        CashSession previous = sessionRepository.findFirstByOrderByBusinessDateDesc().orElse(null);
        if (previous != null && !previous.getBusinessDate().isBefore(today)) {
            throw new IllegalArgumentException("A later day is already recorded in the cash book.");
        }
        BigDecimal carried = previous == null ? null : previous.getCountedCash();
        String note = trim(request.note(), 500, "Note");
        if (carried != null && opening.compareTo(carried) != 0 && note == null) {
            throw new IllegalArgumentException("The opening cash differs from the " + rupees(carried)
                    + " counted at the last closing. Explain why before opening.");
        }

        CashSession session = new CashSession();
        session.setBusinessDate(today);
        session.setStatus(CashSession.OPEN);
        session.setOpeningBalance(opening);
        session.setCarriedForward(carried);
        session.setOpeningNote(note);
        session.setOpenedBy(CurrentUser.name());
        session.setOpenedAt(OffsetDateTime.now());
        session = sessionRepository.saveAndFlush(session);
        auditService.record(ENTITY, session.getId(), carried == null ? "OPEN_FIRST_DAY" : "OPEN",
                note, null, toResponse(session));
        return detail(session);
    }

    public SessionDetail close(Long id, CloseRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("The cash count is required.");
        }
        CashSettings settings = settingsRepository.lockForClosing();
        CashSession session = find(id);
        if (session.isClosed()) {
            // A retry of a close that already went through returns the saved result.
            if (request.requestId() != null && request.requestId().equals(session.getCloseRequestId())) {
                return detail(session);
            }
            throw new IllegalArgumentException("This day was already closed by " + session.getClosedBy() + ".");
        }

        CashSummary summary = ledgerService.summarize(periodStart(session), session.getBusinessDate(),
                session.getOpeningBalance());
        BigDecimal expected = summary.expectedCash();
        if (request.expectedCash() != null && request.expectedCash().compareTo(expected) != 0) {
            throw new IllegalArgumentException("Entries changed while you were counting. Expected cash is now "
                    + rupees(expected) + ". Review the day and confirm the count again.");
        }

        List<CountLine> counts = validateCounts(request.counts());
        BigDecimal counted = counts.stream()
                .map(line -> line.denomination().multiply(BigDecimal.valueOf(line.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.UNNECESSARY);
        BigDecimal difference = counted.subtract(expected);
        String note = trim(request.note(), 1000, "Explanation");

        String approvedBy = null;
        if (difference.signum() != 0) {
            if (note == null) {
                throw new IllegalArgumentException("Counted cash is " + describe(difference)
                        + ". Explain the difference before closing.");
            }
            if (difference.abs().compareTo(settings.getApprovalThreshold()) > 0) {
                if (!CurrentUser.has("CASH_APPROVE")) {
                    throw new AccessDeniedException("Differences above " + rupees(settings.getApprovalThreshold())
                            + " need the owner's approval.");
                }
                approvedBy = CurrentUser.name();
            }
        }

        countRepository.deleteBySessionId(session.getId());
        session = find(id);
        for (CountLine line : counts) {
            countRepository.save(new CashCountLine(session.getId(), line.denomination(), line.quantity()));
        }
        session.setStatus(CashSession.CLOSED);
        session.setExpectedCash(expected);
        session.setCountedCash(counted);
        session.setDifference(difference);
        session.setClosingNote(note);
        session.setClosedBy(CurrentUser.name());
        session.setClosedAt(OffsetDateTime.now());
        session.setApprovedBy(approvedBy);
        session.setCloseRequestId(request.requestId());
        session = sessionRepository.saveAndFlush(session);
        auditService.record(ENTITY, session.getId(), "CLOSE", note, null,
                Map.of("session", toResponse(session), "summary", summary));
        return detail(session);
    }

    public SessionDetail reopen(Long id, ReopenRequest request) {
        if (!CurrentUser.has("CASH_APPROVE")) {
            throw new AccessDeniedException("Only the owner can reopen a closed day.");
        }
        String reason = request == null ? null : trim(request.reason(), 1000, "Reason");
        if (reason == null) {
            throw new IllegalArgumentException("Give a reason for reopening this day.");
        }
        settingsRepository.lockForClosing();
        CashSession session = find(id);
        if (!session.isClosed()) {
            throw new IllegalArgumentException("This day is not closed.");
        }
        CashSession latest = sessionRepository.findFirstByOrderByBusinessDateDesc().orElseThrow();
        if (!latest.getId().equals(session.getId())) {
            throw new IllegalArgumentException("Only the most recent day can be reopened. A later day ("
                    + latest.getBusinessDate().format(DISPLAY_DATE) + ") already uses this day's counted cash;"
                    + " record a correction on that day instead.");
        }

        SessionResponse before = toResponse(session);
        countRepository.deleteBySessionId(session.getId());
        session = find(id);
        session.setStatus(CashSession.OPEN);
        session.setExpectedCash(null);
        session.setCountedCash(null);
        session.setDifference(null);
        session.setClosingNote(null);
        session.setClosedBy(null);
        session.setClosedAt(null);
        session.setApprovedBy(null);
        session.setCloseRequestId(null);
        session.setReopenCount(session.getReopenCount() + 1);
        session = sessionRepository.saveAndFlush(session);
        auditService.record(ENTITY, session.getId(), "REOPEN", reason, before, toResponse(session));
        return detail(session);
    }

    @Transactional(readOnly = true)
    public SessionDetail get(Long id) {
        return detail(find(id));
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> list(LocalDate from, LocalDate to, boolean onlyWithDifference) {
        LocalDate end = to == null ? BusinessDate.today() : to;
        LocalDate start = from == null ? end.minusDays(30) : from;
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date cannot be after end date.");
        }
        return sessionRepository.findInRange(start, end).stream()
                .filter(session -> !onlyWithDifference
                        || (session.getDifference() != null && session.getDifference().signum() != 0))
                .map(this::toResponse)
                .toList();
    }

    public BigDecimal updateApprovalThreshold(SettingsRequest request) {
        if (!CurrentUser.has("CASH_APPROVE")) {
            throw new AccessDeniedException("Only the owner can change cash settings.");
        }
        BigDecimal threshold = money(request == null ? null : request.approvalThreshold(),
                "Approval limit", true);
        CashSettings settings = settingsRepository.lockForClosing();
        BigDecimal before = settings.getApprovalThreshold();
        settings.setApprovalThreshold(threshold);
        settings.setUpdatedBy(CurrentUser.name());
        settings.setUpdatedAt(OffsetDateTime.now());
        auditService.record("CASH_SETTINGS", 1L, "UPDATE", null,
                Map.of("approvalThreshold", before), Map.of("approvalThreshold", threshold));
        return threshold;
    }

    LocalDate periodStart(CashSession session) {
        return sessionRepository.findFirstByBusinessDateLessThanOrderByBusinessDateDesc(session.getBusinessDate())
                .map(previous -> previous.getBusinessDate().plusDays(1))
                .orElse(session.getBusinessDate());
    }

    private SessionDetail detail(CashSession session) {
        LocalDate start = periodStart(session);
        List<LedgerLine> lines = ledgerService.lines(start, session.getBusinessDate());
        CashSummary summary = ledgerService.summarize(start, session.getBusinessDate(),
                session.getOpeningBalance(), lines);
        List<AuditEntry> history = auditRepository
                .findByEntityTypeAndEntityIdOrderByIdDesc(ENTITY, session.getId()).stream()
                .map(entry -> new AuditEntry(entry.getAction(), entry.getActor(),
                        entry.getOccurredAt(), entry.getReason()))
                .toList();
        return new SessionDetail(toResponse(session, start), summary, lines, history);
    }

    private SessionResponse toResponse(CashSession session) {
        return toResponse(session, periodStart(session));
    }

    private SessionResponse toResponse(CashSession session, LocalDate periodStart) {
        List<CountLine> counts = session.getId() == null ? List.of()
                : countRepository.findBySessionIdOrderByDenominationDesc(session.getId()).stream()
                        .map(line -> new CountLine(line.getDenomination(), line.getQuantity()))
                        .toList();
        return new SessionResponse(session.getId(), session.getBusinessDate(), periodStart,
                session.getStatus(), session.getOpeningBalance(), session.getCarriedForward(),
                session.getOpeningNote(), session.getOpenedBy(), session.getOpenedAt(),
                session.getExpectedCash(), session.getCountedCash(), session.getDifference(),
                session.getClosingNote(), session.getClosedBy(), session.getClosedAt(),
                session.getApprovedBy(), session.getReopenCount(), counts);
    }

    private CashSession find(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cash day not found: " + id));
    }

    private static List<CountLine> validateCounts(List<CountLine> counts) {
        if (counts == null) {
            throw new IllegalArgumentException("Enter how many notes and coins were counted.");
        }
        Set<BigDecimal> seen = new HashSet<>();
        List<CountLine> result = new ArrayList<>();
        for (CountLine line : counts) {
            if (line == null || line.denomination() == null) {
                throw new IllegalArgumentException("Each count line needs a denomination.");
            }
            BigDecimal denomination = DENOMINATIONS.stream()
                    .filter(allowed -> allowed.compareTo(line.denomination()) == 0)
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Unsupported denomination: " + line.denomination()));
            if (!seen.add(denomination)) {
                throw new IllegalArgumentException("Denomination " + denomination + " is listed twice.");
            }
            int quantity = line.quantity() == null ? 0 : line.quantity();
            if (quantity < 0 || quantity > MAX_PIECES) {
                throw new IllegalArgumentException("Enter a count between 0 and " + MAX_PIECES
                        + " for ₹" + denomination + ".");
            }
            if (quantity > 0) {
                result.add(new CountLine(denomination, quantity));
            }
        }
        return result;
    }

    static BigDecimal money(BigDecimal value, String label, boolean allowZero) {
        if (value == null) {
            throw new IllegalArgumentException(label + " is required.");
        }
        if (value.signum() < 0 || (!allowZero && value.signum() == 0)) {
            throw new IllegalArgumentException(label + (allowZero ? " cannot be negative." : " must be more than zero."));
        }
        if (value.scale() > 2) {
            throw new IllegalArgumentException(label + " cannot have more than two decimal places.");
        }
        BigDecimal scaled = value.setScale(2, RoundingMode.UNNECESSARY);
        if (scaled.precision() > 14) {
            throw new IllegalArgumentException(label + " is too large.");
        }
        return scaled;
    }

    static String trim(String value, int maxLength, String label) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw new IllegalArgumentException(label + " cannot exceed " + maxLength + " characters.");
        }
        return trimmed;
    }

    static String rupees(BigDecimal amount) {
        return "₹" + amount.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }

    private static String describe(BigDecimal difference) {
        return difference.signum() < 0
                ? rupees(difference.negate()) + " short"
                : rupees(difference) + " more than expected";
    }
}
