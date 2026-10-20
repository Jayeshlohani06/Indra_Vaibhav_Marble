
package com.indravaibhavmarble.expense.controller;

import com.indravaibhavmarble.expense.dto.ExpenseRequest;
import com.indravaibhavmarble.expense.dto.ExpenseResponse;
import com.indravaibhavmarble.expense.dto.ExpenseVoidRequest;
import com.indravaibhavmarble.expense.service.ExpenseService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse createExpense(
            @RequestBody ExpenseRequest request) {
        return expenseService.createExpense(request);
    }

    @PutMapping("/{id}")
    public ExpenseResponse updateExpense(
            @PathVariable Long id,
            @RequestBody ExpenseRequest request) {
        return expenseService.updateExpense(id, request);
    }

    @PostMapping("/{id}/void")
    public ExpenseResponse voidExpense(
            @PathVariable Long id,
            @RequestBody ExpenseVoidRequest request) {
        return expenseService.voidExpense(id, request);
    }

    @GetMapping
    public List<ExpenseResponse> getAllExpenses(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,

            @RequestParam(required = false)
            String category,

            @RequestParam(required = false, defaultValue = "ACTIVE")
            String status) {

        return expenseService.getAllExpenses(
                startDate, endDate, category, status);
    }

    @GetMapping("/{id}")
    public ExpenseResponse getExpenseById(
            @PathVariable Long id) {
        return expenseService.getExpenseById(id);
    }
}
