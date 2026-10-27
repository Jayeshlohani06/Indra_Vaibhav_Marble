package com.indravaibhavmarble.cash.service;

import com.indravaibhavmarble.cash.dto.CashSummary;
import com.indravaibhavmarble.cash.dto.LedgerLine;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The cash book, read straight from where each entry is stored: customer
 * payments and refunds, supplier payments, active expenses and drawer
 * movements. Nothing is copied, so nothing can be counted twice.
 */
@Service
@Transactional(readOnly = true)
public class CashLedgerService {

    public static final String CASH = "CASH";
    private static final List<String> METHOD_ORDER =
            List.of("CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER");
    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private static final String LEDGER_SQL = """
            SELECT 'SALES_PAYMENT', p.id, p.payment_date,
                   CASE WHEN p.amount < 0 THEN 'REFUND'
                        WHEN p.payment_date = o.order_date THEN 'SALE_RECEIPT'
                        ELSE 'COLLECTION' END,
                   p.payment_method, p.amount, o.order_number, c.name,
                   p.reference_number, p.created_by, p.created_at
            FROM sales_order_payments p
            JOIN sales_orders o ON o.id = p.sales_order_id
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE p.payment_date BETWEEN :from AND :to
            UNION ALL
            SELECT 'PURCHASE_PAYMENT', pp.id, pp.payment_date, 'SUPPLIER_PAYMENT',
                   pp.payment_method, -pp.amount, pu.purchase_number, s.name,
                   pp.reference_number, pp.created_by, pp.created_at
            FROM purchase_payments pp
            JOIN purchases pu ON pu.id = pp.purchase_id
            LEFT JOIN suppliers s ON s.id = pu.supplier_id
            WHERE pp.payment_date BETWEEN :from AND :to
            UNION ALL
            SELECT 'EXPENSE', e.id, e.expense_date, 'EXPENSE',
                   e.payment_method, -e.amount, e.reference_number,
                   COALESCE(sm.name, e.payee, sup.name),
                   e.category || COALESCE(' - ' || e.description, ''),
                   e.created_by, e.created_at
            FROM expenses e
            LEFT JOIN staff_members sm ON sm.id = e.staff_member_id
            LEFT JOIN suppliers sup ON sup.id = e.supplier_id
            WHERE e.status = 'ACTIVE' AND e.expense_date BETWEEN :from AND :to
            UNION ALL
            SELECT 'CASH_MOVEMENT', m.id, m.movement_date, m.movement_type, 'CASH',
                   CASE WHEN m.movement_type IN ('OWNER_CASH_IN', 'BANK_WITHDRAWAL', 'ADJUSTMENT_IN')
                        THEN m.amount ELSE -m.amount END,
                   m.reference_number, CAST(NULL AS VARCHAR), m.notes,
                   m.created_by, m.created_at
            FROM cash_movements m
            WHERE m.status = 'ACTIVE' AND m.movement_date BETWEEN :from AND :to
            """;

    private final EntityManager entityManager;

    public CashLedgerService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public List<LedgerLine> lines(LocalDate from, LocalDate to) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(LEDGER_SQL)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
        List<LedgerLine> lines = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            lines.add(new LedgerLine(
                    (String) row[0],
                    ((Number) row[1]).longValue(),
                    toLocalDate(row[2]),
                    (String) row[3],
                    (String) row[4],
                    (BigDecimal) row[5],
                    (String) row[6],
                    (String) row[7],
                    (String) row[8],
                    (String) row[9],
                    toOffsetDateTime(row[10])));
        }
        lines.sort(Comparator.comparing(LedgerLine::date)
                .thenComparing(LedgerLine::createdAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(LedgerLine::source)
                .thenComparing(LedgerLine::sourceId));
        return lines;
    }

    public CashSummary summarize(LocalDate from, LocalDate to, BigDecimal openingBalance) {
        return summarize(from, to, openingBalance, lines(from, to));
    }

    public CashSummary summarize(LocalDate from, LocalDate to, BigDecimal openingBalance,
            List<LedgerLine> lines) {
        Map<String, MethodAccumulator> byMethod = new LinkedHashMap<>();
        METHOD_ORDER.forEach(method -> byMethod.put(method, new MethodAccumulator()));
        BigDecimal ownerIn = ZERO, ownerOut = ZERO, bankIn = ZERO, bankOut = ZERO,
                adjustIn = ZERO, adjustOut = ZERO;

        for (LedgerLine line : lines) {
            MethodAccumulator totals = byMethod.computeIfAbsent(line.paymentMethod(),
                    method -> new MethodAccumulator());
            BigDecimal amount = line.amount();
            switch (line.kind()) {
                case "SALE_RECEIPT" -> totals.saleReceipts = totals.saleReceipts.add(amount);
                case "COLLECTION" -> totals.collections = totals.collections.add(amount);
                case "REFUND" -> totals.refunds = totals.refunds.add(amount.negate());
                case "SUPPLIER_PAYMENT" -> totals.supplierPayments = totals.supplierPayments.add(amount.negate());
                case "EXPENSE" -> totals.expenses = totals.expenses.add(amount.negate());
                case "OWNER_CASH_IN" -> ownerIn = ownerIn.add(amount);
                case "OWNER_CASH_OUT" -> ownerOut = ownerOut.add(amount.negate());
                case "BANK_WITHDRAWAL" -> bankIn = bankIn.add(amount);
                case "BANK_DEPOSIT" -> bankOut = bankOut.add(amount.negate());
                case "ADJUSTMENT_IN" -> adjustIn = adjustIn.add(amount);
                case "ADJUSTMENT_OUT" -> adjustOut = adjustOut.add(amount.negate());
                default -> throw new IllegalStateException("Unknown cash book entry: " + line.kind());
            }
            totals.net = totals.net.add(amount);
        }

        MethodAccumulator cash = byMethod.get(CASH);
        BigDecimal totalIn = cash.saleReceipts.add(cash.collections).add(ownerIn).add(bankIn).add(adjustIn);
        BigDecimal totalOut = cash.refunds.add(cash.supplierPayments).add(cash.expenses)
                .add(ownerOut).add(bankOut).add(adjustOut);
        BigDecimal opening = openingBalance == null ? ZERO : openingBalance;
        BigDecimal expected = opening.add(totalIn).subtract(totalOut);

        CashSummary.CashFlows flows = new CashSummary.CashFlows(
                cash.saleReceipts, cash.collections, ownerIn, bankIn, adjustIn,
                cash.refunds, cash.supplierPayments, cash.expenses, ownerOut, bankOut, adjustOut,
                totalIn, totalOut);

        List<CashSummary.MethodTotals> methods = byMethod.entrySet().stream()
                .map(entry -> new CashSummary.MethodTotals(entry.getKey(),
                        entry.getValue().saleReceipts, entry.getValue().collections,
                        entry.getValue().refunds, entry.getValue().supplierPayments,
                        entry.getValue().expenses, entry.getValue().net))
                .toList();

        Object[] sales = (Object[]) entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(o.grand_total), 0),
                       COALESCE(SUM(GREATEST(o.grand_total - o.returned_total - COALESCE(p.paid, 0), 0)), 0)
                FROM sales_orders o
                LEFT JOIN (SELECT sales_order_id, SUM(amount) AS paid
                           FROM sales_order_payments GROUP BY sales_order_id) p
                       ON p.sales_order_id = o.id
                WHERE o.order_date BETWEEN :from AND :to
                  AND o.status NOT IN ('DRAFT', 'CANCELLED')
                """).setParameter("from", from).setParameter("to", to).getSingleResult();
        Object[] purchases = (Object[]) entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(pu.total_amount), 0),
                       COALESCE(SUM(GREATEST(pu.total_amount - COALESCE(p.paid, 0), 0)), 0)
                FROM purchases pu
                LEFT JOIN (SELECT purchase_id, SUM(amount) AS paid
                           FROM purchase_payments GROUP BY purchase_id) p
                       ON p.purchase_id = pu.id
                WHERE pu.purchase_date BETWEEN :from AND :to
                  AND pu.status = 'RECEIVED'
                """).setParameter("from", from).setParameter("to", to).getSingleResult();

        return new CashSummary(from, to, opening, flows, expected, methods,
                (BigDecimal) sales[0], (BigDecimal) sales[1],
                (BigDecimal) purchases[0], (BigDecimal) purchases[1]);
    }

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date date) {
            return date.toLocalDate();
        }
        return (LocalDate) value;
    }

    private static OffsetDateTime toOffsetDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof OffsetDateTime offset) {
            return offset;
        }
        if (value instanceof Instant instant) {
            return instant.atOffset(ZoneOffset.UTC);
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().atOffset(ZoneOffset.UTC);
        }
        throw new IllegalStateException("Unexpected timestamp type: " + value.getClass());
    }

    private static final class MethodAccumulator {
        BigDecimal saleReceipts = ZERO;
        BigDecimal collections = ZERO;
        BigDecimal refunds = ZERO;
        BigDecimal supplierPayments = ZERO;
        BigDecimal expenses = ZERO;
        BigDecimal net = ZERO;
    }
}
