
package com.indravaibhavmarble.expense.repository;

import com.indravaibhavmarble.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findAllByOrderByExpenseDateDescIdDesc();

    boolean existsByCategoryIgnoreCase(String category);

    Optional<Expense> findByRequestId(UUID requestId);

    List<Expense> findByExpenseDateBetweenOrderByExpenseDateDescIdDesc(
            LocalDate startDate,
            LocalDate endDate
    );

    List<Expense> findByCategoryIgnoreCaseOrderByExpenseDateDescIdDesc(
            String category
    );

    List<Expense> findByExpenseDateBetweenAndCategoryIgnoreCaseOrderByExpenseDateDescIdDesc(
            LocalDate startDate,
            LocalDate endDate,
            String category
    );

    List<Expense> findByStatusAndExpenseDateBetweenOrderByExpenseDateDescIdDesc(
            String status,
            LocalDate startDate,
            LocalDate endDate
    );
}
