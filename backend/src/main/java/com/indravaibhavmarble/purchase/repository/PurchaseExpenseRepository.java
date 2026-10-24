package com.indravaibhavmarble.purchase.repository;

import com.indravaibhavmarble.purchase.entity.PurchaseExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseExpenseRepository
        extends JpaRepository<PurchaseExpense, Long> {
    List<PurchaseExpense> findByPurchaseIdOrderByIdAsc(Long purchaseId);
    void deleteByPurchaseId(Long purchaseId);
}
