
package com.indravaibhavmarble.expense.repository;

import com.indravaibhavmarble.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findAllByOrderByExpenseDateDescIdDesc();

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
}
