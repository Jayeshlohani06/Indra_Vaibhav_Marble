package com.indravaibhavmarble.expense.service;

import com.indravaibhavmarble.cash.entity.CashSettings;
import com.indravaibhavmarble.cash.repository.CashSettingsRepository;
import com.indravaibhavmarble.cash.service.CashPeriodGuard;
import com.indravaibhavmarble.cash.service.FinancialAuditService;
import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.common.security.CurrentUser;
import com.indravaibhavmarble.expense.dto.ExpenseRequest;
import com.indravaibhavmarble.expense.dto.ExpenseResponse;
import com.indravaibhavmarble.expense.dto.ExpenseVoidRequest;
import com.indravaibhavmarble.expense.entity.Expense;
import com.indravaibhavmarble.expense.entity.ExpenseCategory;
import com.indravaibhavmarble.expense.repository.ExpenseCategoryRepository;
import com.indravaibhavmarble.expense.repository.ExpenseRepository;
import com.indravaibhavmarble.staff.StaffMember;
import com.indravaibhavmarble.staff.StaffMemberRepository;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.time.OffsetDateTime;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class ExpenseService {

    private static final String AUDIT_ENTITY = "EXPENSE";

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
    private final ExpenseCategoryRepository categoryRepository;
    private final StaffMemberRepository staffRepository;
    private final CashPeriodGuard periodGuard;
    private final FinancialAuditService auditService;
    private final CashSettingsRepository cashSettingsRepository;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            SupplierRepository supplierRepository,
            ExpenseCategoryRepository categoryRepository,
            StaffMemberRepository staffRepository,
            CashPeriodGuard periodGuard,
            FinancialAuditService auditService,
            CashSettingsRepository cashSettingsRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.supplierRepository = supplierRepository;
        this.categoryRepository = categoryRepository;
        this.staffRepository = staffRepository;
        this.periodGuard = periodGuard;
        this.auditService = auditService;
        this.cashSettingsRepository = cashSettingsRepository;
    }

    public ExpenseResponse createExpense(ExpenseRequest request) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Expense data is required"
            );
        }

        // A repeated save of the same form returns the expense already recorded.
        if (request.requestId() != null) {
            var existing = expenseRepository.findByRequestId(request.requestId());
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }

        Expense expense = new Expense();
        apply(expense, request);
        validateExpense(expense);
        normalize(expense);
        applyCategoryRules(expense, null, null);
        requireReceiptForLargeExpense(expense);
        validateSupplier(expense);
        periodGuard.assertOpen(expense.getExpenseDate());

        expense.setRequestId(request.requestId());
        expense.setCreatedBy(CurrentUser.name());

        Expense saved = expenseRepository.saveAndFlush(expense);
        ExpenseResponse response = toResponse(saved);
        auditService.record(AUDIT_ENTITY, saved.getId(), "CREATE", null, null, response);
        return response;
    }

    public ExpenseResponse updateExpense(Long id, ExpenseRequest request) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found: " + id));
        if ("VOIDED".equals(expense.getStatus())) {
            throw new IllegalArgumentException("Voided expenses cannot be edited");
        }
        if (request == null) {
            throw new IllegalArgumentException("Expense data is required");
        }
        periodGuard.assertOpen(expense.getExpenseDate());
        ExpenseResponse before = toResponse(expense);
        String previousCategory = expense.getCategory();
        Long previousStaff = expense.getStaffMemberId();

        apply(expense, request);
        validateExpense(expense);
        normalize(expense);
        applyCategoryRules(expense, previousCategory, previousStaff);
        requireReceiptForLargeExpense(expense);
        validateSupplier(expense);
        periodGuard.assertOpen(expense.getExpenseDate());
        expense.setUpdatedBy(CurrentUser.name());

        Expense saved = expenseRepository.saveAndFlush(expense);
        ExpenseResponse after = toResponse(saved);
        auditService.record(AUDIT_ENTITY, saved.getId(), "UPDATE", null, before, after);
        return after;
    }

    public ExpenseResponse voidExpense(Long id, ExpenseVoidRequest request) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found: " + id));
        if ("VOIDED".equals(expense.getStatus())) {
            throw new IllegalArgumentException("Expense is already voided");
        }
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new IllegalArgumentException("A void reason is required");
        }
        if (request.reason().trim().length() > 500) {
            throw new IllegalArgumentException("Void reason cannot exceed 500 characters");
        }
        periodGuard.assertOpen(expense.getExpenseDate());
        ExpenseResponse before = toResponse(expense);
        expense.setStatus("VOIDED");
        expense.setVoidedAt(OffsetDateTime.now());
        expense.setVoidReason(request.reason().trim());
        expense.setVoidedBy(CurrentUser.name());
        ExpenseResponse after = toResponse(expenseRepository.saveAndFlush(expense));
        auditService.record(AUDIT_ENTITY, id, "VOID", expense.getVoidReason(), before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> getAllExpenses(
            LocalDate startDate,
            LocalDate endDate,
            String category,
            String status
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

        String requestedStatus = status == null || status.isBlank()
                ? "ACTIVE" : status.trim().toUpperCase();
        if (!Set.of("ACTIVE", "VOIDED", "ALL").contains(requestedStatus)) {
            throw new IllegalArgumentException("Invalid expense status");
        }

        Map<Long, String> staffNames = staffRepository.findAll().stream()
                .collect(Collectors.toMap(StaffMember::getId, StaffMember::getName));
        return expenses.stream()
                .filter(expense -> "ALL".equals(requestedStatus)
                        || requestedStatus.equals(expense.getStatus()))
                .map(expense -> toResponse(expense, staffNames::get))
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

    private static void apply(Expense expense, ExpenseRequest request) {
        expense.setExpenseDate(request.expenseDate());
        expense.setCategory(request.category());
        expense.setDescription(request.description());
        expense.setAmount(request.amount());
        expense.setPaymentMethod(request.paymentMethod());
        expense.setSupplierId(request.supplierId());
        expense.setReferenceNumber(request.referenceNumber());
        expense.setNotes(request.notes());
        expense.setPayee(request.payee());
        expense.setStaffMemberId(request.staffMemberId());
        expense.setSalaryPeriod(request.salaryPeriod());
    }

    /**
     * The category must be one from the list (an expense may keep an older
     * category it was already saved with). Salary and advance categories need
     * a staff member and the month the money is for.
     */
    private void applyCategoryRules(Expense expense, String previousCategory, Long previousStaff) {
        boolean categoryUnchanged = previousCategory != null
                && previousCategory.equalsIgnoreCase(expense.getCategory());
        ExpenseCategory category = categoryRepository.findByNameIgnoreCase(expense.getCategory()).orElse(null);
        if (category == null && !categoryUnchanged) {
            throw new IllegalArgumentException("Choose a category from the list");
        }
        if (category != null && !category.isActive() && !categoryUnchanged) {
            throw new IllegalArgumentException("The category " + category.getName() + " is turned off");
        }
        if (category != null) {
            expense.setCategory(category.getName());
            if (category.isRequiresDescription() && expense.getDescription() == null) {
                throw new IllegalArgumentException(
                        "Add a description for " + category.getName() + " expenses");
            }
        }

        String staffPaymentType = category == null ? null : category.getStaffPaymentType();
        if (staffPaymentType != null) {
            if (expense.getStaffMemberId() == null) {
                throw new IllegalArgumentException("Choose the staff member this "
                        + ("SALARY".equals(staffPaymentType) ? "salary" : "advance") + " was paid to");
            }
            if (expense.getSalaryPeriod() == null) {
                throw new IllegalArgumentException("Choose the month this payment is for");
            }
        }
        if (expense.getStaffMemberId() != null) {
            StaffMember staff = staffRepository.findById(expense.getStaffMemberId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Staff member not found: " + expense.getStaffMemberId()));
            if (!staff.isActive() && !Objects.equals(previousStaff, staff.getId())) {
                throw new IllegalArgumentException(staff.getName() + " is no longer active");
            }
        }
        expense.setSalaryPeriod(expense.getStaffMemberId() == null || expense.getSalaryPeriod() == null
                ? null : expense.getSalaryPeriod().withDayOfMonth(1));
    }

    /** Big expenses need a bill or receipt number, unless the owner records them. */
    private void requireReceiptForLargeExpense(Expense expense) {
        BigDecimal limit = cashSettingsRepository.findById(CashSettings.ID)
                .map(CashSettings::getLargeExpenseThreshold).orElse(BigDecimal.ZERO);
        if (limit.signum() > 0 && expense.getAmount().compareTo(limit) > 0
                && expense.getReferenceNumber() == null && !CurrentUser.has("CASH_APPROVE")) {
            throw new IllegalArgumentException("Expenses above ₹" + limit.toPlainString()
                    + " need a bill or receipt number. Ask the owner if there is no bill.");
        }
    }

    private ExpenseResponse toResponse(Expense expense) {
        return toResponse(expense, id -> staffRepository.findById(id)
                .map(StaffMember::getName).orElse(null));
    }

    private ExpenseResponse toResponse(Expense expense, Function<Long, String> staffName) {
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
                expense.getStatus(),
                expense.getVoidedAt(),
                expense.getVoidReason(),
                expense.getCreatedAt(),
                expense.getUpdatedAt(),
                expense.getPayee(),
                expense.getStaffMemberId(),
                expense.getStaffMemberId() == null ? null : staffName.apply(expense.getStaffMemberId()),
                expense.getSalaryPeriod(),
                expense.getCreatedBy(),
                expense.getUpdatedBy(),
                expense.getVoidedBy()
        );
    }

    private void normalize(Expense expense) {
        expense.setCategory(expense.getCategory().trim());
        if (expense.getDescription() != null) {
            String description = expense.getDescription().trim();
            expense.setDescription(description.isEmpty() ? null : description);
        }
        expense.setPaymentMethod(expense.getPaymentMethod().trim().toUpperCase());
        if (expense.getReferenceNumber() != null) {
            String reference = expense.getReferenceNumber().trim();
            expense.setReferenceNumber(reference.isEmpty() ? null : reference);
        }
        if (expense.getNotes() != null) {
            String notes = expense.getNotes().trim();
            expense.setNotes(notes.isEmpty() ? null : notes);
        }
        if (expense.getPayee() != null) {
            String payee = expense.getPayee().trim();
            expense.setPayee(payee.isEmpty() ? null : payee);
        }
    }

    private void validateSupplier(Expense expense) {
        if (expense.getSupplierId() != null) {
            supplierRepository.findByIdAndActiveTrue(expense.getSupplierId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Supplier not found or inactive: " + expense.getSupplierId()));
        }
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

        if (expense.getPayee() != null
                && expense.getPayee().trim().length() > 150) {
            throw new IllegalArgumentException(
                    "Paid to cannot exceed 150 characters"
            );
        }
    }
}
