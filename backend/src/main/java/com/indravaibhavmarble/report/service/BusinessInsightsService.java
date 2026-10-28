package com.indravaibhavmarble.report.service;

import com.indravaibhavmarble.common.time.BusinessDate;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Payment reminders and a rough monthly profit, read from stored bills and expenses. */
@Service
@Transactional(readOnly = true)
public class BusinessInsightsService {

    private final EntityManager entityManager;

    public BusinessInsightsService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** A customer with unpaid bills, and how old the oldest unpaid one is. */
    public record PaymentReminderRow(Long customerId, String customerName, String phone,
            long unpaidBills, BigDecimal amountDue, LocalDate oldestBillDate, long daysOverdue) {
    }

    /**
     * One month. Sales and returns are without GST. Cost of goods uses each
     * product's current purchase price, so profit is an estimate. Tax
     * payments (GST, TDS) are not costs and are left out of expenses.
     */
    public record MonthlyProfitRow(LocalDate month, BigDecimal sales, BigDecimal returns,
            BigDecimal costOfGoods, BigDecimal expenses, BigDecimal estimatedProfit) {
    }

    public List<PaymentReminderRow> paymentReminders(int minDays) {
        if (minDays < 0 || minDays > 3650) {
            throw new IllegalArgumentException("Days must be between 0 and 3650.");
        }
        LocalDate today = BusinessDate.today();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                WITH due AS (
                    SELECT o.customer_id, o.order_date,
                           o.grand_total - o.returned_total - COALESCE(p.paid, 0) AS amount_due
                    FROM sales_orders o
                    LEFT JOIN (SELECT sales_order_id, SUM(amount) AS paid
                               FROM sales_order_payments GROUP BY sales_order_id) p
                           ON p.sales_order_id = o.id
                    WHERE o.status NOT IN ('DRAFT', 'CANCELLED')
                )
                SELECT c.id, c.name, c.phone, COUNT(*), SUM(d.amount_due), MIN(d.order_date)
                FROM due d
                JOIN customers c ON c.id = d.customer_id
                WHERE d.amount_due > 0
                GROUP BY c.id, c.name, c.phone
                HAVING MIN(d.order_date) <= :cutoff
                ORDER BY MIN(d.order_date), SUM(d.amount_due) DESC
                """).setParameter("cutoff", today.minusDays(minDays)).getResultList();
        return rows.stream().map(row -> {
            LocalDate oldest = toLocalDate(row[5]);
            return new PaymentReminderRow(((Number) row[0]).longValue(), (String) row[1], (String) row[2],
                    ((Number) row[3]).longValue(), (BigDecimal) row[4], oldest,
                    ChronoUnit.DAYS.between(oldest, today));
        }).toList();
    }

    public List<MonthlyProfitRow> monthlyProfit(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? BusinessDate.today() : to;
        LocalDate start = (from == null ? end.minusMonths(5) : from).withDayOfMonth(1);
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date cannot be after end date.");
        }
        if (ChronoUnit.MONTHS.between(start, end) > 36) {
            throw new IllegalArgumentException("Choose at most 36 months.");
        }
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                WITH months AS (
                    SELECT generate_series(CAST(:start AS date), CAST(:end AS date), interval '1 month')::date AS month
                ),
                sales AS (
                    SELECT date_trunc('month', o.order_date)::date AS month,
                           SUM(o.grand_total - o.cgst_amount - o.sgst_amount - o.igst_amount) AS amount
                    FROM sales_orders o
                    WHERE o.status NOT IN ('DRAFT', 'CANCELLED') AND o.order_date BETWEEN :start AND :end
                    GROUP BY 1
                ),
                sold_cost AS (
                    SELECT date_trunc('month', o.order_date)::date AS month,
                           SUM(i.quantity * p.purchase_price) AS amount
                    FROM sales_order_items i
                    JOIN sales_orders o ON o.id = i.sales_order_id
                    JOIN products p ON p.id = i.product_id
                    WHERE o.status NOT IN ('DRAFT', 'CANCELLED') AND o.order_date BETWEEN :start AND :end
                    GROUP BY 1
                ),
                returns AS (
                    SELECT date_trunc('month', r.return_date)::date AS month,
                           SUM(r.total_amount - r.cgst_amount - r.sgst_amount - r.igst_amount) AS amount
                    FROM sales_returns r
                    JOIN sales_orders o ON o.id = r.sales_order_id
                    WHERE o.status <> 'CANCELLED' AND r.return_date BETWEEN :start AND :end
                    GROUP BY 1
                ),
                returned_cost AS (
                    SELECT date_trunc('month', r.return_date)::date AS month,
                           SUM(ri.quantity * p.purchase_price) AS amount
                    FROM sales_return_items ri
                    JOIN sales_returns r ON r.id = ri.sales_return_id
                    JOIN sales_orders o ON o.id = r.sales_order_id
                    JOIN sales_order_items i ON i.id = ri.sales_order_item_id
                    JOIN products p ON p.id = i.product_id
                    WHERE o.status <> 'CANCELLED' AND r.return_date BETWEEN :start AND :end
                    GROUP BY 1
                ),
                spent AS (
                    SELECT date_trunc('month', e.expense_date)::date AS month, SUM(e.amount) AS amount
                    FROM expenses e
                    LEFT JOIN expense_categories c ON lower(c.name) = lower(e.category)
                    WHERE e.status = 'ACTIVE' AND e.expense_date BETWEEN :start AND :end
                      AND COALESCE(c.group_name, '') <> 'Taxes & statutory'
                    GROUP BY 1
                )
                SELECT m.month,
                       COALESCE(s.amount, 0), COALESCE(r.amount, 0),
                       COALESCE(sc.amount, 0) - COALESCE(rc.amount, 0),
                       COALESCE(x.amount, 0)
                FROM months m
                LEFT JOIN sales s ON s.month = m.month
                LEFT JOIN returns r ON r.month = m.month
                LEFT JOIN sold_cost sc ON sc.month = m.month
                LEFT JOIN returned_cost rc ON rc.month = m.month
                LEFT JOIN spent x ON x.month = m.month
                ORDER BY m.month DESC
                """).setParameter("start", start).setParameter("end", end).getResultList();
        return rows.stream().map(row -> {
            BigDecimal sales = scale((BigDecimal) row[1]);
            BigDecimal returns = scale((BigDecimal) row[2]);
            BigDecimal cost = scale((BigDecimal) row[3]);
            BigDecimal expenses = scale((BigDecimal) row[4]);
            return new MonthlyProfitRow(toLocalDate(row[0]), sales, returns, cost, expenses,
                    sales.subtract(returns).subtract(cost).subtract(expenses));
        }).toList();
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static LocalDate toLocalDate(Object value) {
        return value instanceof java.sql.Date date ? date.toLocalDate() : (LocalDate) value;
    }
}
