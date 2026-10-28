package com.indravaibhavmarble.cash.service;

import com.indravaibhavmarble.cash.dto.CashSummary;
import com.indravaibhavmarble.cash.dto.LedgerLine;
import com.indravaibhavmarble.cash.repository.FinancialAuditRepository;
import com.indravaibhavmarble.common.time.BusinessDate;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cash book and expense reports, all read from stored entries. */
@Service
@Transactional(readOnly = true)
public class CashReportService {

    private static final long MAX_RANGE_DAYS = 400;

    private final CashLedgerService ledgerService;
    private final FinancialAuditRepository auditRepository;
    private final EntityManager entityManager;

    public CashReportService(CashLedgerService ledgerService, FinancialAuditRepository auditRepository,
            EntityManager entityManager) {
        this.ledgerService = ledgerService;
        this.auditRepository = auditRepository;
        this.entityManager = entityManager;
    }

    /** Every entry in the range; the summary's opening is zero, so its expected cash is the net change. */
    public record Cashbook(List<LedgerLine> lines, CashSummary summary) {
    }

    public record ExpenseGroupRow(String groupName, String category, String paymentMethod,
            long count, BigDecimal total) {
    }

    /** {@code balance} is monthly salary minus salary and advances paid; null when no monthly salary is set. */
    public record StaffPaymentRow(Long staffMemberId, String staffName, LocalDate salaryPeriod,
            BigDecimal salary, BigDecimal advances, BigDecimal otherPayments, BigDecimal total,
            BigDecimal monthlySalary, BigDecimal balance) {
    }

    public record AuditRow(Long id, String entityType, Long entityId, String action, String actor,
            OffsetDateTime occurredAt, String reason, String beforeState, String afterState) {
    }

    public Cashbook cashbook(LocalDate from, LocalDate to, String paymentMethod, String kind) {
        LocalDate[] range = range(from, to);
        List<LedgerLine> all = ledgerService.lines(range[0], range[1]);
        List<LedgerLine> lines = all.stream()
                .filter(line -> paymentMethod == null || paymentMethod.isBlank()
                        || paymentMethod.equalsIgnoreCase(line.paymentMethod()))
                .filter(line -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(line.kind()))
                .toList();
        return new Cashbook(lines, ledgerService.summarize(range[0], range[1], BigDecimal.ZERO, all));
    }

    public List<ExpenseGroupRow> expensesByCategory(LocalDate from, LocalDate to) {
        LocalDate[] range = range(from, to);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT COALESCE(c.group_name, 'Miscellaneous'), e.category, e.payment_method,
                       COUNT(*), SUM(e.amount)
                FROM expenses e
                LEFT JOIN expense_categories c ON lower(c.name) = lower(e.category)
                WHERE e.status = 'ACTIVE' AND e.expense_date BETWEEN :from AND :to
                GROUP BY 1, 2, 3
                ORDER BY 1, 2, 3
                """).setParameter("from", range[0]).setParameter("to", range[1]).getResultList();
        return rows.stream().map(row -> new ExpenseGroupRow((String) row[0], (String) row[1],
                (String) row[2], ((Number) row[3]).longValue(), (BigDecimal) row[4])).toList();
    }

    /**
     * Salary and advances per staff member and month. An advance is salary
     * paid early, so salary + advances is what the person received.
     */
    public List<StaffPaymentRow> staffPayments(LocalDate from, LocalDate to) {
        LocalDate[] range = range(from, to);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT sm.id, sm.name, e.salary_period, sm.monthly_salary,
                       COALESCE(SUM(e.amount) FILTER (WHERE c.staff_payment_type = 'SALARY'), 0),
                       COALESCE(SUM(e.amount) FILTER (WHERE c.staff_payment_type = 'ADVANCE'), 0),
                       COALESCE(SUM(e.amount) FILTER (WHERE c.staff_payment_type IS NULL), 0),
                       SUM(e.amount)
                FROM expenses e
                JOIN staff_members sm ON sm.id = e.staff_member_id
                LEFT JOIN expense_categories c ON lower(c.name) = lower(e.category)
                WHERE e.status = 'ACTIVE' AND e.expense_date BETWEEN :from AND :to
                GROUP BY sm.id, sm.name, e.salary_period, sm.monthly_salary
                ORDER BY sm.name, e.salary_period NULLS LAST
                """).setParameter("from", range[0]).setParameter("to", range[1]).getResultList();
        return rows.stream().map(row -> {
            LocalDate period = row[2] instanceof java.sql.Date date ? date.toLocalDate() : (LocalDate) row[2];
            BigDecimal monthly = (BigDecimal) row[3];
            BigDecimal salary = (BigDecimal) row[4];
            BigDecimal advances = (BigDecimal) row[5];
            BigDecimal balance = monthly == null || period == null ? null
                    : monthly.subtract(salary).subtract(advances);
            return new StaffPaymentRow(((Number) row[0]).longValue(), (String) row[1], period,
                    salary, advances, (BigDecimal) row[6], (BigDecimal) row[7], monthly, balance);
        }).toList();
    }

    public List<AuditRow> recentAudit() {
        return auditRepository.findTop200ByOrderByIdDesc().stream()
                .map(entry -> new AuditRow(entry.getId(), entry.getEntityType(), entry.getEntityId(),
                        entry.getAction(), entry.getActor(), entry.getOccurredAt(), entry.getReason(),
                        entry.getBeforeState(), entry.getAfterState()))
                .toList();
    }

    private static LocalDate[] range(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? BusinessDate.today() : to;
        LocalDate start = from == null ? end.withDayOfMonth(1) : from;
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date cannot be after end date.");
        }
        if (ChronoUnit.DAYS.between(start, end) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("Choose a range of at most " + MAX_RANGE_DAYS + " days.");
        }
        return new LocalDate[] {start, end};
    }
}
