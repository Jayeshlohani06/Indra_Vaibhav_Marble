package com.indravaibhavmarble.expense.controller;

import com.indravaibhavmarble.expense.entity.ExpenseCategory;
import com.indravaibhavmarble.expense.repository.ExpenseCategoryRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/expense-categories")
public class ExpenseCategoryController {
    private final ExpenseCategoryRepository repository;

    public ExpenseCategoryController(ExpenseCategoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<ExpenseCategory> getCategories() {
        return repository.findByActiveTrueOrderByNameAsc();
    }

    @PostMapping
    public ExpenseCategory createCategory(@RequestBody ExpenseCategory category) {
        if (category == null || category.getName() == null || category.getName().isBlank()) {
            throw new IllegalArgumentException("Expense category name is required");
        }
        String name = category.getName().trim();
        if (repository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("An expense category with this name already exists");
        }
        category.setName(name);
        category.setActive(true);
        return repository.save(category);
    }
}
