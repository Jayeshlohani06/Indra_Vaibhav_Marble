package com.indravaibhavmarble.expense.repository;

import com.indravaibhavmarble.expense.entity.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, Long> {
    List<ExpenseCategory> findByActiveTrueOrderByNameAsc();
    Optional<ExpenseCategory> findByNameIgnoreCase(String name);
}
