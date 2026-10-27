package com.indravaibhavmarble.cash;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.indravaibhavmarble.cash.dto.CashMovementDtos.MovementRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.CloseRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.CountLine;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.OpenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.ReopenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SessionDetail;
import com.indravaibhavmarble.cash.dto.CashSummary;
import com.indravaibhavmarble.cash.service.CashMovementService;
import com.indravaibhavmarble.cash.service.CashReportService;
import com.indravaibhavmarble.cash.service.CashSessionService;
import com.indravaibhavmarble.common.time.BusinessDate;
import com.indravaibhavmarble.expense.dto.ExpenseRequest;
import com.indravaibhavmarble.expense.dto.ExpenseVoidRequest;
import com.indravaibhavmarble.expense.service.ExpenseService;
import com.indravaibhavmarble.purchase.dto.PurchasePaymentRequest;
import com.indravaibhavmarble.purchase.service.PurchasePaymentService;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderPaymentRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.dto.SalesReturnItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnRequest;
import com.indravaibhavmarble.salesorder.service.SalesOrderPaymentService;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;
import com.indravaibhavmarble.salesorder.service.SalesReturnService;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opens a day, records every kind of money entry, counts and closes it,
 * against the real database. Each test runs in one transaction that is
 * rolled back afterwards, so existing data is never touched.
 */
@SpringBootTest
@Transactional
class CashClosingFlowTest {

    private static final String[] OWNER = {"CASH_READ", "CASH_MANAGE", "CASH_APPROVE",
            "SALES_MANAGE", "PAYMENT_MANAGE", "EXPENSE_MANAGE"};

    @Autowired private EntityManager entityManager;
    @Autowired private CashSessionService sessionService;
    @Autowired private CashMovementService movementService;
    @Autowired private CashReportService reportService;
    @Autowired private ExpenseService expenseService;
    @Autowired private SalesOrderService orderService;
    @Autowired private SalesOrderPaymentService salesPaymentService;
    @Autowired private PurchasePaymentService purchasePaymentService;
    @Autowired private SalesReturnService returnService;

    private final LocalDate today = BusinessDate.today();
    private String tag;
    private Long productId;
    private Long customerId;
    private Long supplierId;
    private Long staffId;

    @BeforeEach
    void setUp() {
        runAs(OWNER);
        // Start from an empty cash book inside this (rolled back) transaction.
        entityManager.createNativeQuery("DELETE FROM cash_count_lines").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM cash_sessions").executeUpdate();

        tag = Long.toString(System.nanoTime(), 36);
        Long unitId = insert("INSERT INTO measurement_units (code, name, is_active, created_at) VALUES ('T" + tag
                + "', 'Test unit', true, now()) RETURNING id");
        Long categoryId = insert("INSERT INTO product_categories (name, is_active, created_at, updated_at) VALUES ('Test "
                + tag + "', true, now(), now()) RETURNING id");
        productId = insert("INSERT INTO products (product_code, name, category_id, unit_id, selling_price, purchase_price,"
                + " gst_rate, stock_quantity, secondary_stock_quantity, low_stock_threshold, is_active, created_at, updated_at)"
                + " VALUES ('P" + tag + "', 'Test marble', " + categoryId + ", " + unitId
                + ", 100, 60, 18, 100, 0, 0, true, now(), now()) RETURNING id");
        customerId = insert("INSERT INTO customers (customer_code, name, phone, credit_limit, is_active, created_at, updated_at)"
                + " VALUES ('C" + tag + "', 'Test customer', '9000000000', 0, true, now(), now()) RETURNING id");
        supplierId = insert("INSERT INTO suppliers (name, is_active, created_at, updated_at) VALUES ('Supplier "
                + tag + "', true, now(), now()) RETURNING id");
        staffId = insert("INSERT INTO staff_members (name, is_active, created_at, updated_at) VALUES ('Staff "
                + tag + "', true, now(), now()) RETURNING id");
    }

    @AfterEach
    void clearUser() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void wholeDayReconcilesFromStoredEntriesOnly() {
        closedDay(today.minusDays(1), "5000.00");
        SessionDetail day = sessionService.open(new OpenRequest(new BigDecimal("5000"), null));
        assertThat(day.session().carriedForward()).isEqualByComparingTo("5000");
        Long sessionId = day.session().id();

        // Bill of 1180 paid 1000 cash + 180 UPI: only the cash reaches the drawer.
        SalesOrderResponse bill = bill(today, 10);
        pay(bill, "1000", "CASH");
        pay(bill, "180", "UPI");
        // Older bill collected today in cash: a collection, not a new sale.
        SalesOrderResponse oldBill = bill(today, 5);
        entityManager.createNativeQuery("UPDATE sales_orders SET order_date = :d WHERE id = :id")
                .setParameter("d", today.minusDays(10)).setParameter("id", oldBill.id()).executeUpdate();
        pay(oldBill, "500", "CASH");
        // A credit bill: raises receivables, never cash.
        bill(today, 2);
        // Purchase received without payment changes nothing; a cash payment does.
        Long purchaseId = insert("INSERT INTO purchases (purchase_number, supplier_id, purchase_date, status, total_amount)"
                + " VALUES ('PT" + tag + "', " + supplierId + ", '" + today + "', 'RECEIVED', 900) RETURNING id");
        purchasePaymentService.recordPayment(purchaseId,
                new PurchasePaymentRequest(today, new BigDecimal("300"), "CASH", null, null));
        // Cash and digital expenses.
        expense("Tea & snacks", "200", "CASH", null);
        expense("Internet & telephone", "100", "UPI", null);
        // Owner puts cash in; cash is deposited at the bank.
        movement("OWNER_CASH_IN", "1000", null);
        movement("BANK_DEPOSIT", "2000", null);
        // One unit returned from the paid bill, refunded in cash (118).
        returnService.createReturn(bill.id(), new SalesReturnRequest(null, "Chipped", "CASH",
                List.of(new SalesReturnItemRequest(bill.items().get(0).id(), BigDecimal.ONE, null))));
        entityManager.flush();

        CashSummary summary = sessionService.get(sessionId).summary();
        assertThat(summary.cash().saleReceipts()).isEqualByComparingTo("1000");
        assertThat(summary.cash().collections()).isEqualByComparingTo("500");
        assertThat(summary.cash().ownerCashIn()).isEqualByComparingTo("1000");
        assertThat(summary.cash().supplierPayments()).isEqualByComparingTo("300");
        assertThat(summary.cash().expenses()).isEqualByComparingTo("200");
        assertThat(summary.cash().bankDeposits()).isEqualByComparingTo("2000");
        assertThat(summary.cash().refunds()).isEqualByComparingTo("118");
        // 5000 + 1000 + 500 + 1000 - 300 - 200 - 2000 - 118
        assertThat(summary.expectedCash()).isEqualByComparingTo("4882");
        CashSummary.MethodTotals upi = summary.byMethod().stream()
                .filter(method -> method.paymentMethod().equals("UPI")).findFirst().orElseThrow();
        assertThat(upi.saleReceipts()).isEqualByComparingTo("180");
        assertThat(upi.expenses()).isEqualByComparingTo("100");
        // Bills dated today: 1180 (paid) and the 236 credit bill, still owed.
        assertThat(summary.billsRaised()).isEqualByComparingTo("1416");
        assertThat(summary.billsStillUnpaid()).isEqualByComparingTo("236");
        assertThat(summary.purchasesStillUnpaid()).isEqualByComparingTo("600");

        // 9x500 + 200 + 100 + 50 + 20 + 10 + 2 = 4882
        UUID requestId = UUID.randomUUID();
        CloseRequest close = new CloseRequest(counts(500, 9, 200, 1, 100, 1, 50, 1, 20, 1, 10, 1, 2, 1),
                null, new BigDecimal("4882.00"), requestId);
        SessionDetail closed = sessionService.close(sessionId, close);
        assertThat(closed.session().status()).isEqualTo("CLOSED");
        assertThat(closed.session().countedCash()).isEqualByComparingTo("4882");
        assertThat(closed.session().difference()).isEqualByComparingTo("0");

        // A retried close with the same request returns the same result.
        assertThat(sessionService.close(sessionId, close).session().closedAt())
                .isEqualTo(closed.session().closedAt());
        assertThatThrownBy(() -> sessionService.close(sessionId, new CloseRequest(
                close.counts(), null, null, UUID.randomUUID())))
                .hasMessageContaining("already closed");

        // Nothing can be dated into the closed day any more, whatever the method.
        assertThatThrownBy(() -> pay(oldBill, "10", "UPI")).hasMessageContaining("closed");
        assertThatThrownBy(() -> expense("Tea & snacks", "10", "CASH", null)).hasMessageContaining("closed");
        assertThatThrownBy(() -> movement("OWNER_CASH_IN", "10", null)).hasMessageContaining("closed");
        Long expenseId = ((Number) entityManager.createNativeQuery(
                "SELECT id FROM expenses WHERE category = 'Tea & snacks' AND expense_date = :d"
                        + " AND amount = 200 ORDER BY id DESC LIMIT 1").setParameter("d", today)
                .getSingleResult()).longValue();
        assertThatThrownBy(() -> expenseService.voidExpense(expenseId, new ExpenseVoidRequest("Wrong")))
                .hasMessageContaining("closed");

        // The owner can reopen the latest day; entries are allowed again.
        assertThatThrownBy(() -> sessionService.reopen(sessionId, new ReopenRequest(" ")))
                .hasMessageContaining("reason");
        SessionDetail reopened = sessionService.reopen(sessionId, new ReopenRequest("Late UPI receipt"));
        assertThat(reopened.session().status()).isEqualTo("OPEN");
        assertThat(reopened.session().reopenCount()).isEqualTo(1);
        assertThat(reopened.history()).extracting("action").contains("REOPEN", "CLOSE", "OPEN");
        pay(oldBill, "10", "UPI");
    }

    @Test
    void openingDifferentFromLastCountNeedsAReason() {
        closedDay(today.minusDays(1), "5000.00");
        assertThatThrownBy(() -> sessionService.open(new OpenRequest(new BigDecimal("4000"), null)))
                .hasMessageContaining("differs");
        SessionDetail day = sessionService.open(new OpenRequest(new BigDecimal("4000"), "Took 1000 home last night"));
        assertThat(day.session().openingBalance()).isEqualByComparingTo("4000");
        assertThatThrownBy(() -> sessionService.open(new OpenRequest(new BigDecimal("4000"), "again")))
                .hasMessageContaining("already open");
    }

    @Test
    void previousDayMustBeClosedBeforeOpeningToday() {
        insert("INSERT INTO cash_sessions (business_date, status, opening_balance, opened_by)"
                + " VALUES ('" + today.minusDays(1) + "', 'OPEN', 100, 'x') RETURNING id");
        assertThatThrownBy(() -> sessionService.open(new OpenRequest(new BigDecimal("100"), null)))
                .hasMessageContaining("still open");
    }

    @Test
    void differencesNeedAReasonAndLargeOnesNeedTheOwner() {
        Long sessionId = sessionService.open(new OpenRequest(new BigDecimal("1000"), "First day")).session().id();

        // 50 short with no reason is refused.
        assertThatThrownBy(() -> sessionService.close(sessionId,
                new CloseRequest(counts(500, 1, 200, 2, 50, 1), null, null, null)))
                .hasMessageContaining("₹50.00 short");

        // 600 short is above the 500 limit: a closer without approval rights is refused.
        runAs("CASH_READ", "CASH_MANAGE");
        assertThatThrownBy(() -> sessionService.close(sessionId,
                new CloseRequest(counts(200, 2), "Gave change", null, null)))
                .isInstanceOf(AccessDeniedException.class);
        // A small difference with a reason is fine.
        SessionDetail closed = sessionService.close(sessionId,
                new CloseRequest(counts(500, 1, 200, 2, 50, 1), "Paid a porter from the drawer", null, null));
        assertThat(closed.session().difference()).isEqualByComparingTo("-50");
        assertThat(closed.session().approvedBy()).isNull();
        assertThat(reportService.recentAudit()).extracting("action").contains("CLOSE");
    }

    @Test
    void closingIsRefusedWhenEntriesChangedDuringTheCount() {
        Long sessionId = sessionService.open(new OpenRequest(new BigDecimal("1000"), null)).session().id();
        movement("OWNER_CASH_IN", "100", null);
        assertThatThrownBy(() -> sessionService.close(sessionId,
                new CloseRequest(counts(500, 2), null, new BigDecimal("1000.00"), null)))
                .hasMessageContaining("changed while you were counting");
    }

    @Test
    void onlyTheMostRecentDayCanBeReopened() {
        Long older = closedDay(today.minusDays(2), "100.00");
        closedDay(today.minusDays(1), "100.00");
        assertThatThrownBy(() -> sessionService.reopen(older, new ReopenRequest("Mistake")))
                .hasMessageContaining("Only the most recent day");
    }

    @Test
    void correctionsNeedTheOwnerAndAReason() {
        sessionService.open(new OpenRequest(BigDecimal.ZERO, null));
        assertThatThrownBy(() -> movement("ADJUSTMENT_OUT", "50", null)).hasMessageContaining("Explain");
        runAs("CASH_READ", "CASH_MANAGE");
        assertThatThrownBy(() -> movement("ADJUSTMENT_OUT", "50", "Payment entered as cash, was UPI"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void salaryNeedsStaffAndMonthAndAdvanceCountsOnce() {
        assertThatThrownBy(() -> expense("Salary", "8000", "CASH", null))
                .hasMessageContaining("staff member");
        expenseService.createExpense(new ExpenseRequest(today, "Staff advance", null, new BigDecimal("2000"),
                "CASH", null, null, null, null, staffId, today, null));
        expenseService.createExpense(new ExpenseRequest(today, "Salary", null, new BigDecimal("8000"),
                "BANK_TRANSFER", null, null, null, null, staffId, today.withDayOfMonth(15), null));
        entityManager.flush();
        var rows = reportService.staffPayments(today.withDayOfMonth(1), today).stream()
                .filter(row -> row.staffMemberId().equals(staffId)).toList();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).salaryPeriod()).isEqualTo(today.withDayOfMonth(1));
        assertThat(rows.get(0).advances()).isEqualByComparingTo("2000");
        assertThat(rows.get(0).salary()).isEqualByComparingTo("8000");
        assertThat(rows.get(0).total()).isEqualByComparingTo("10000");
    }

    @Test
    void repeatedExpenseSubmissionIsRecordedOnce() {
        UUID requestId = UUID.randomUUID();
        ExpenseRequest request = new ExpenseRequest(today, "Tea & snacks", null, new BigDecimal("40"),
                "CASH", null, null, null, null, null, null, requestId);
        Long first = expenseService.createExpense(request).id();
        Long second = expenseService.createExpense(request).id();
        assertThat(second).isEqualTo(first);
        assertThatThrownBy(() -> expense("No such category " + tag, "10", "CASH", null))
                .hasMessageContaining("Choose a category");
        assertThatThrownBy(() -> expense("Miscellaneous", "10", "CASH", null))
                .hasMessageContaining("description");
    }

    // --- helpers ---

    private static void runAs(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("owner@example.com", null, authorities));
    }

    private Long insert(String sql) {
        return ((Number) entityManager.createNativeQuery(sql).getSingleResult()).longValue();
    }

    private Long closedDay(LocalDate date, String counted) {
        return insert("INSERT INTO cash_sessions (business_date, status, opening_balance, opened_by,"
                + " expected_cash, counted_cash, difference, closed_by, closed_at)"
                + " VALUES ('" + date + "', 'CLOSED', " + counted + ", 'x', " + counted + ", " + counted
                + ", 0, 'x', now()) RETURNING id");
    }

    private SalesOrderResponse bill(LocalDate date, int quantity) {
        return orderService.createOrder(new SalesOrderRequest(customerId, date, "INTRA", null,
                List.of(new SalesOrderItemRequest(productId, new BigDecimal(quantity), null, null, null, null)),
                null));
    }

    private void pay(SalesOrderResponse bill, String amount, String method) {
        salesPaymentService.recordPayment(bill.id(),
                new SalesOrderPaymentRequest(today, new BigDecimal(amount), method, null, null));
    }

    private void expense(String category, String amount, String method, String description) {
        expenseService.createExpense(new ExpenseRequest(today, category, description, new BigDecimal(amount),
                method, null, null, null, null, null, null, null));
    }

    private void movement(String type, String amount, String notes) {
        movementService.create(new MovementRequest(today, type, new BigDecimal(amount), null, notes, null));
    }

    /** Pairs of denomination and quantity. */
    private static List<CountLine> counts(int... pairs) {
        return IntStream.range(0, pairs.length / 2)
                .mapToObj(i -> new CountLine(new BigDecimal(pairs[2 * i]), pairs[2 * i + 1]))
                .toList();
    }
}
