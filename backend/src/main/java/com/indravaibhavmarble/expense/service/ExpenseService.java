
package com.indravaibhavmarble.expense.service;

import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.expense.dto.ExpenseRequest;
import com.indravaibhavmarble.expense.dto.ExpenseResponse;
import com.indravaibhavmarble.expense.entity.Expense;
import com.indravaibhavmarble.expense.repository.ExpenseRepository;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
@Transactional
public class ExpenseService {

    private static final Set<String> PAYMENT_METHODS = Set.of(
            "CASH",
            "UPI",
            "BANK_TRANSFER",
            "CHEQUE",
            "CARD",
            "OTHER"
    );

    private final ExpenseRepository expenseRepository;
    private final SupplierRepository supplierRepository;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            SupplierRepository supplierRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.supplierRepository = supplierRepository;
    }

    public ExpenseResponse createExpense(ExpenseRequest request) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Expense data is required"
            );
        }

        Expense expense = new Expense();

        expense.setExpenseDate(request.expenseDate());
        expense.setCategory(request.category());
        expense.setDescription(request.description());
        expense.setAmount(request.amount());
        expense.setPaymentMethod(request.paymentMethod());
        expense.setSupplierId(request.supplierId());
        expense.setReferenceNumber(request.referenceNumber());
        expense.setNotes(request.notes());

        validateExpense(expense);

        // Validate the optional supplier reference.
        if (expense.getSupplierId() != null) {
            supplierRepository
                    .findByIdAndActiveTrue(expense.getSupplierId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Supplier not found or inactive: "
                                    + expense.getSupplierId()
                    ));
        }

        expense.setCategory(expense.getCategory().trim());
        if (expense.getDescription() != null) {
    String description = expense.getDescription().trim();
    expense.setDescription(description.isEmpty() ? null : description);
}
        expense.setPaymentMethod(
                expense.getPaymentMethod().trim().toUpperCase()
        );

        if (expense.getReferenceNumber() != null) {
            expense.setReferenceNumber(
                    expense.getReferenceNumber().trim()
            );
        }

        if (expense.getNotes() != null) {
            expense.setNotes(expense.getNotes().trim());
        }

        return toResponse(expenseRepository.save(expense));
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> getAllExpenses(
            LocalDate startDate,
            LocalDate endDate,
            String category
    ) {
        if (startDate != null
                && endDate != null
                && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException(
                    "Start date cannot be after end date"
            );
        }

        boolean hasCategory = category != null
                && !category.isBlank();

        List<Expense> expenses;

        if (startDate != null && endDate != null && hasCategory) {
            expenses = expenseRepository
                    .findByExpenseDateBetweenAndCategoryIgnoreCaseOrderByExpenseDateDescIdDesc(
                            startDate,
                            endDate,
                            category.trim()
                    );
        } else if (startDate != null && endDate != null) {
            expenses = expenseRepository
                    .findByExpenseDateBetweenOrderByExpenseDateDescIdDesc(
                            startDate,
                            endDate
                    );
        } else if (hasCategory) {
            expenses = expenseRepository
                    .findByCategoryIgnoreCaseOrderByExpenseDateDescIdDesc(
                            category.trim()
                    );
        } else {
            expenses = expenseRepository
                    .findAllByOrderByExpenseDateDescIdDesc();
        }

        return expenses.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExpenseResponse getExpenseById(Long id) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Expense not found: " + id
                        )
                );

        return toResponse(expense);
    }

    private ExpenseResponse toResponse(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getExpenseDate(),
                expense.getCategory(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getPaymentMethod(),
                expense.getSupplierId(),
                expense.getReferenceNumber(),
                expense.getNotes(),
                expense.getCreatedAt(),
                expense.getUpdatedAt()
        );
    }

    private void validateExpense(Expense expense) {
        if (expense == null) {
            throw new IllegalArgumentException(
                    "Expense data is required"
            );
        }

        if (expense.getExpenseDate() == null) {
            throw new IllegalArgumentException(
                    "Expense date is required"
            );
        }

        if (expense.getCategory() == null
                || expense.getCategory().isBlank()
                || expense.getCategory().trim().length() > 100) {
            throw new IllegalArgumentException(
                    "Category is required and cannot exceed 100 characters"
            );
        }

        if (expense.getDescription() != null
        && expense.getDescription().trim().length() > 500) {
    throw new IllegalArgumentException(
            "Description cannot exceed 500 characters"
    );
}

        BigDecimal amount = expense.getAmount();

        if (amount == null
                || amount.signum() <= 0
                || amount.scale() > 2
                || amount.precision() > 14) {
            throw new IllegalArgumentException(
                    "Amount must be positive with at most 2 decimal places"
            );
        }

        if (expense.getPaymentMethod() == null
                || !PAYMENT_METHODS.contains(
                        expense.getPaymentMethod().trim().toUpperCase()
                )) {
            throw new IllegalArgumentException(
                    "Invalid expense payment method"
            );
        }

        if (expense.getReferenceNumber() != null
                && expense.getReferenceNumber().length() > 100) {
            throw new IllegalArgumentException(
                    "Reference number cannot exceed 100 characters"
            );
        }

        if (expense.getNotes() != null
                && expense.getNotes().length() > 1000) {
            throw new IllegalArgumentException(
                    "Notes cannot exceed 1000 characters"
            );
        }
    }
}
