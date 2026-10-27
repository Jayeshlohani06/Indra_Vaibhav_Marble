package com.indravaibhavmarble.expense.controller;

import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.expense.entity.ExpenseCategory;
import com.indravaibhavmarble.expense.repository.ExpenseCategoryRepository;
import com.indravaibhavmarble.expense.repository.ExpenseRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/expense-categories")
public class ExpenseCategoryController {

    public record CategoryRequest(String name, String description, String categoryType,
            String groupName, String staffPaymentType, Boolean requiresDescription, Boolean active) {
    }

    private static final Set<String> CATEGORY_TYPES =
            Set.of("OPERATING", "ADMINISTRATIVE", "SELLING", "FINANCIAL", "OTHER");
    private static final Set<String> STAFF_PAYMENT_TYPES = Set.of("SALARY", "ADVANCE");

    private final ExpenseCategoryRepository repository;
    private final ExpenseRepository expenseRepository;

    public ExpenseCategoryController(ExpenseCategoryRepository repository,
            ExpenseRepository expenseRepository) {
        this.repository = repository;
        this.expenseRepository = expenseRepository;
    }

    @GetMapping
    public List<ExpenseCategory> getCategories(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return includeInactive
                ? repository.findAllByOrderByGroupNameAscNameAsc()
                : repository.findByActiveTrueOrderByNameAsc();
    }

    @PostMapping
    @Transactional
    public ExpenseCategory createCategory(@RequestBody CategoryRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Expense category name is required");
        }
        String name = request.name().trim();
        if (repository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("An expense category with this name already exists");
        }
        ExpenseCategory category = ExpenseCategory.create();
        category.setName(name);
        apply(category, request);
        category.setActive(true);
        return repository.save(category);
    }

    @PutMapping("/{id}")
    @Transactional
    public ExpenseCategory updateCategory(@PathVariable Long id, @RequestBody CategoryRequest request) {
        ExpenseCategory category = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense category not found: " + id));
        if (request == null) {
            throw new IllegalArgumentException("Category details are required");
        }
        if (request.name() != null && !request.name().isBlank()
                && !request.name().trim().equals(category.getName())) {
            String name = request.name().trim();
            // Expenses keep the category name they were saved with, so a used
            // category is retired and replaced rather than renamed.
            if (expenseRepository.existsByCategoryIgnoreCase(category.getName())) {
                throw new IllegalArgumentException(
                        "This category is already used by expenses. Turn it off and add a new one instead.");
            }
            repository.findByNameIgnoreCase(name)
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(other -> {
                        throw new IllegalArgumentException("An expense category with this name already exists");
                    });
            category.setName(name);
        }
        apply(category, request);
        if (request.active() != null) {
            category.setActive(request.active());
        }
        return repository.save(category);
    }

    private static void apply(ExpenseCategory category, CategoryRequest request) {
        if (category.getName().length() > 100) {
            throw new IllegalArgumentException("Category name cannot exceed 100 characters");
        }
        if (request.description() != null) {
            String description = request.description().trim();
            if (description.length() > 255) {
                throw new IllegalArgumentException("Description cannot exceed 255 characters");
            }
            category.setDescription(description.isEmpty() ? null : description);
        }
        if (request.categoryType() != null && !request.categoryType().isBlank()) {
            String type = request.categoryType().trim().toUpperCase(Locale.ROOT);
            if (!CATEGORY_TYPES.contains(type)) {
                throw new IllegalArgumentException("Invalid category type");
            }
            category.setCategoryType(type);
        }
        if (request.groupName() != null && !request.groupName().isBlank()) {
            String group = request.groupName().trim();
            if (group.length() > 60) {
                throw new IllegalArgumentException("Group name cannot exceed 60 characters");
            }
            category.setGroupName(group);
        }
        if (request.staffPaymentType() != null) {
            String type = request.staffPaymentType().trim().toUpperCase(Locale.ROOT);
            if (!type.isEmpty() && !STAFF_PAYMENT_TYPES.contains(type)) {
                throw new IllegalArgumentException("Staff payment type must be SALARY or ADVANCE");
            }
            category.setStaffPaymentType(type.isEmpty() ? null : type);
        }
        if (request.requiresDescription() != null) {
            category.setRequiresDescription(request.requiresDescription());
        }
    }
}
