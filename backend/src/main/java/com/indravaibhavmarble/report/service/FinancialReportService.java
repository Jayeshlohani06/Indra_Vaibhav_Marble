
package com.indravaibhavmarble.report.service;

import com.indravaibhavmarble.expense.entity.Expense;
import com.indravaibhavmarble.expense.repository.ExpenseRepository;
import com.indravaibhavmarble.purchase.entity.Purchase;
import com.indravaibhavmarble.purchase.repository.PurchaseRepository;
import com.indravaibhavmarble.report.dto.FinancialSummaryResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class FinancialReportService {

    private static final Set<String> EXCLUDED_SALES_STATUSES =
            Set.of("DRAFT", "CANCELLED");

    private final SalesOrderRepository salesOrderRepository;
    private final PurchaseRepository purchaseRepository;
    private final ExpenseRepository expenseRepository;

    public FinancialReportService(
            SalesOrderRepository salesOrderRepository,
            PurchaseRepository purchaseRepository,
            ExpenseRepository expenseRepository) {
        this.salesOrderRepository = salesOrderRepository;
        this.purchaseRepository = purchaseRepository;
        this.expenseRepository = expenseRepository;
    }

    public FinancialSummaryResponse getFinancialSummary(
            LocalDate startDate,
            LocalDate endDate) {

        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException(
                    "Start date and end date are required.");
        }

        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException(
                    "Start date must be on or before end date.");
        }

        List<SalesOrder> salesOrders =
                salesOrderRepository
                        .findByOrderDateBetweenAndStatusNotIn(
                                startDate,
                                endDate,
                                List.copyOf(EXCLUDED_SALES_STATUSES));

        List<Purchase> receivedPurchases =
                purchaseRepository
                        .findByPurchaseDateBetweenAndStatus(
                                startDate,
                                endDate,
                                "RECEIVED");

        List<Expense> expenses =
                expenseRepository
                        .findByStatusAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                                "ACTIVE",
                                startDate,
                                endDate);

        BigDecimal salesTotal = salesOrders.stream()
                // Goods returned on a bill no longer count as sold.
                .map(SalesOrder::getNetTotal)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal purchaseTotal = receivedPurchases.stream()
                .map(Purchase::getTotalAmount)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expenseTotal = expenses.stream()
                .map(Expense::getAmount)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new FinancialSummaryResponse(
                startDate,
                endDate,
                salesOrders.size(),
                salesTotal,
                receivedPurchases.size(),
                purchaseTotal,
                expenses.size(),
                expenseTotal);
    }
}
